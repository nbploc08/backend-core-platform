import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { BullModule, BullRootModuleOptions } from '@nestjs/bullmq';
import { MailsModule } from '../mails/mails.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../../.env'],
    }),
    MailsModule,
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
  providers: [JobsService],
})
export class JobsModule {}
