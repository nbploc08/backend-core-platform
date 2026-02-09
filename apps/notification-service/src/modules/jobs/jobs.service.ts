import { Job, Queue } from 'bullmq';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { MailsService } from '../mails/mails.service';
import { ErrorCodes, logger, ServiceError } from '@common/core';
import { HttpStatus, OnModuleInit } from '@nestjs/common';

@Processor('mail')
export class JobsService extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly mailsService: MailsService,
    @InjectQueue('mail') private readonly queue: Queue,
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

    // Xử lý lỗi cho Queue (Producer - dù có thể không dùng nhưng vẫn init connection)
    handleRedisError(this.queue, 'Queue');

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
          throw new ServiceError({
            code: ErrorCodes.INTERNAL,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error sending verify code',
          });
        }
        break;

      case 'reset-password':
        await this.sendResetPassword(job.data);
        break;
    }
  }

  async sendResetPassword(data) {}
}
