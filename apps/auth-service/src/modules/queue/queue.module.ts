import { Module } from '@nestjs/common';
import { BullModule, BullRootModuleOptions } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../../.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<BullRootModuleOptions> => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not configured. Please set REDIS_URL in .env file');
        }
        return {
          connection: {
            url: redisUrl,
          },
        };
      },
    }),

    BullModule.registerQueue({
      name: 'mail',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
