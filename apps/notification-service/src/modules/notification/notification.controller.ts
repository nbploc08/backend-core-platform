import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User, UserOnly, TokenTypeGuard } from '@common/core';
import { NotificationService } from './notification.service';

@UseGuards(TokenTypeGuard)
@UserOnly()
@Controller('notification/internal')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  findAll(
    @User('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.listByUser(userId, page, limit);
  }

  @Get('unread-count')
  unreadCount(@User('userId') userId: string) {
    return this.notificationService.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @User('userId') userId: string) {
    return this.notificationService.markRead(userId, id);
  }

  @Post('read-all')
  readAll(@User('userId') userId: string) {
    return this.notificationService.readAll(userId);
  }
}
