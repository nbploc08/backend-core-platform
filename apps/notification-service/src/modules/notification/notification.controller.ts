import { Controller, Get, Patch, Param, Delete } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UserRegisteredEventDto } from './dto/userRegisteredEvent.dto';
import { USER_REGISTERED } from '@contracts/core';
import { logger } from '@common/core';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // Lắng nghe event USER_REGISTERED từ auth-service qua NATS subject 'user.registered'
  @MessagePattern(USER_REGISTERED)
  create(@Payload() userRegisteredEvent: UserRegisteredEventDto) {
    logger.info({ userRegisteredEvent }, 'User registered event received');
    return this.notificationService.create(userRegisteredEvent);
  }

  @Get()
  findAll() {
    return this.notificationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Payload() updateNotificationDto: UpdateNotificationDto) {
    return this.notificationService.update(+id, updateNotificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationService.remove(+id);
  }
}
