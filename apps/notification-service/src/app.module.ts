import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationModule } from './modules/notification/notification.module';
import { MailsModule } from './modules/mails/mails.module';

@Module({
  imports: [NotificationModule, MailsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
