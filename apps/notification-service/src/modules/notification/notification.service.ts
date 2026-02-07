import { Injectable } from '@nestjs/common';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UserRegisteredEventDto } from './dto/userRegisteredEvent.dto';
import { MailsService } from '../mails/mails.service';
import { decrypt, getEncryptKey, logger } from '@common/core';

@Injectable()
export class NotificationService {
  constructor(private readonly mailsService: MailsService) {}

  async create(userRegisteredEvent: UserRegisteredEventDto): Promise<boolean> {
    const code = decrypt(userRegisteredEvent.code, getEncryptKey());
    await this.mailsService.sendVerifyCode(userRegisteredEvent.email, code);
    logger.info(`Send verify code to ${userRegisteredEvent.email}`);
    return true;
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
