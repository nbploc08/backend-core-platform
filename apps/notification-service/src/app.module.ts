import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsModule } from './modules/nats/nats.module';
import { NotificationModule } from './modules/notification/notification.module';
import { MailsModule } from './modules/mails/mails.module';
import { JetstreamModule } from './modules/jetstream/jetstream.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    NatsModule,
    NotificationModule,
    MailsModule,
    JetstreamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
