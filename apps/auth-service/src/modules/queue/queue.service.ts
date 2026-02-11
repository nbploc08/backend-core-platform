import {
  PASSWORD_RESET_REQUESTED,
  PasswordResetRequestedEvent,
  UserRegisteredEvent,
} from '@contracts/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { logger } from '@common/core';

@Injectable()
export class QueueService implements OnModuleInit {
  constructor(@InjectQueue('mail') private queue: Queue) {}

  async onModuleInit() {
    this.queue.removeAllListeners('error');
    this.queue.on('error', (error) => {
      const err = error as any;
      if (
        err.code === 'ECONNREFUSED' ||
        (err.name === 'AggregateError' && err.code === 'ECONNREFUSED')
      ) {
        logger.warn('Redis connection refused. Retrying...');
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
        'Redis connection error',
      );
    });

    try {
      await this.queue.waitUntilReady();
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

  async sendVerifyCode(userRegisteredEvent: UserRegisteredEvent) {
    await this.queue.add('send-verify-code', userRegisteredEvent);
  }
  async sendResetPassword(passwordResetRequestedEvent: PasswordResetRequestedEvent) {
    await this.queue.add(PASSWORD_RESET_REQUESTED, passwordResetRequestedEvent, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
