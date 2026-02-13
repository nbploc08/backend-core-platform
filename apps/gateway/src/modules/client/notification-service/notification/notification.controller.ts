import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Public } from '@common/core';

@Controller('client/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  @Public()
  @Get('healthz')
  ping() {
    return this.notificationService.ping();
  }
}
