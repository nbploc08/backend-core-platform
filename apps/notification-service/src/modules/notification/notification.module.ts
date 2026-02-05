import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { MailsModule } from '../mails/mails.module';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  imports: [MailsModule],
})
export class NotificationModule {}
