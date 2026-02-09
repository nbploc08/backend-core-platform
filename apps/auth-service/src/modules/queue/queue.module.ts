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
      useFactory: async (configService: ConfigService): Promise<BullRootModuleOptions> => ({
        connection: {
          url: configService.get<string>('REDIS_URL') || '',
        },
      }),
    }),

    BullModule.registerQueue({
      name: 'mail',
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
