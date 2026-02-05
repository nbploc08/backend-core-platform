import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UserRegisteredEventDto } from './dto/userRegisteredEvent.dto';
import { MailsService } from '../mails/mails.service';

@Injectable()
export class NotificationService {
  constructor(private readonly mailsService: MailsService) {}
  create(userRegisteredEvent: UserRegisteredEventDto) {
    return this.mailsService.sendVerifyCode(userRegisteredEvent.email, userRegisteredEvent.code);
  }

  findAll() {
    return `This action returns all notification`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }

  update(id: number, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification`;
  }

  remove(id: number) {
    return `This action removes a #${id} notification`;
  }
}
