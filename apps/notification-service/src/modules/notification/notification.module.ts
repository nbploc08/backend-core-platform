import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { MailsModule } from 'src/modules/mails/mails.module';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  imports: [MailsModule],
  exports: [NotificationService],
})
export class NotificationModule {}
