import { Job, Queue } from 'bullmq';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { MailsService } from '../mails/mails.service';
import { decrypt, ErrorCodes, getEncryptKey, logger, ServiceError } from '@common/core';
import { HttpStatus, OnModuleInit } from '@nestjs/common';
import { PASSWORD_RESET_REQUESTED } from '@contracts/core';

@Processor('mail')
export class JobsService extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly mailsService: MailsService,
    @InjectQueue('mail') private readonly queue: Queue,
    @InjectQueue('mail-dlq') private readonly dlqQueue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    const handleRedisError = (instance: any, type: string) => {
      if (instance.listenerCount('error') > 0) {
        instance.removeAllListeners('error');
      }

      instance.on('error', (error: any) => {
        const err = error as any;
        if (
          err.code === 'ECONNREFUSED' ||
          (err.name === 'AggregateError' && err.code === 'ECONNREFUSED')
        ) {
          logger.warn(`Redis ${type} connection refused. Retrying...`);
          return;
        }

        const message =
          error.name === 'AggregateError' && 'errors' in error
            ? (error as any).errors.map((e: any) => e.message).join(', ')
            : error.message;

        logger.error(
          {
            message,
            code: (error as any).code,
          },
          `Redis ${type} connection error`,
        );
      });
    };

    // Xử lý lỗi cho Worker (Consumer)
    handleRedisError(this.worker, 'Worker');

    // Xử lý lỗi cho Queue
    handleRedisError(this.queue, 'Queue');

    //  Khi job fail sau N lần retry → audit log email.failed + push vào DLQ
    this.worker.on('failed', async (job: Job | undefined, error: Error) => {
      // Nếu job vẫn còn lượt retry thì return, để BullMQ tự handle retry
      if (job?.opts?.attempts && job.attemptsMade < job.opts.attempts) {
        return;
      }

      const traceId = job?.id ?? 'unknown';
      const jobName = job?.name ?? 'unknown';
      const attemptsMade = job?.attemptsMade ?? 0;
      const failedReason = error?.message ?? 'Unknown error';

      logger.error(
        {
          event: 'email.failed',
          traceId,
          jobName,
          attemptsMade,
          failedReason,
          email: job?.data?.email != null ? '[redacted]' : undefined,
        },
        'email.failed',
      );

      try {
        await this.dlqQueue.add(
          'failed-mail-job',
          {
            originalJobId: traceId,
            jobName,
            failedReason,
            attemptedAt: new Date().toISOString(),
            dataKeys: job?.data ? Object.keys(job.data) : [],
          },
          { removeOnComplete: { count: 1000 } },
        );
      } catch (dlqErr) {
        logger.error({ traceId, error: (dlqErr as Error).message }, 'Failed to add job to DLQ');
      }
    });

    try {
      await this.worker.waitUntilReady();
      logger.info('Redis connection established successfully');
    } catch (error) {
      const err = error as any;
      if (
        err.code === 'ECONNREFUSED' ||
        (err.name === 'AggregateError' && err.code === 'ECONNREFUSED')
      ) {
        logger.error('Failed to establish initial Redis connection: Connection refused');
      } else {
        const message =
          error.name === 'AggregateError' && 'errors' in error
            ? (error as any).errors.map((e: any) => e.message).join(', ')
            : error.message;

        logger.error(
          {
            message,
            code: (error as any).code,
          },
          'Redis connection failed',
        );
      }
    }
  }

  async process(job: Job) {
    switch (job.name) {
      case 'send-verify-code':
        try {
          await this.mailsService.sendVerifyCode(job.data.email, job.data.code);
          logger.info(`Send verify code to ${job.data.email}`);
        } catch (error) {
          logger.error(
            {
              error: error.message,
              stack: error.stack,
              jobId: job.id,
              jobName: job.name,
              email: job.data.email,
            },
            'Error sending verify code',
          );
          throw new ServiceError({
            code: ErrorCodes.INTERNAL,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: `Error sending verify code: ${error.message}`,
          });
        }
        break;

      case PASSWORD_RESET_REQUESTED:
        try {
          await this.mailsService.sendResetPassword(job.data.email, job.data.token);
          logger.info(`Send reset password to ${job.data.email}`);
        } catch (error) {
          logger.error(
            {
              error: error.message,
              jobId: job.id,
              email: job.data.email,
              token: job.data.token,
            },
            'Error sending reset password',
          );
          throw new ServiceError({
            code: ErrorCodes.INTERNAL,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: `Error sending reset password: ${error.message}`,
          });
        }
        break;
    }
  }
}
