import { Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Info, PermissionCode, RequirePermission, User } from '@common/core';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private resolveUserId(
    user?: { userId?: string },
    infoData?: { userId?: string },
    headerUserId?: string,
  ): string {
    return user?.userId ?? infoData?.userId ?? headerUserId ?? '';
  }

  @Get('list')
  @RequirePermission(PermissionCode.NOTIFICATIONS_READ)
  findAll(
    @User() user: { userId?: string } | undefined,
    @Info('data') infoData: { userId?: string } | undefined,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const userId = this.resolveUserId(user, infoData, headerUserId);
    return this.notificationService.listByUser(userId, page, limit, sortBy, sortOrder);
  }

  @Get('unread-count')
  @RequirePermission(PermissionCode.NOTIFICATIONS_READ)
  unreadCount(
    @User() user: { userId?: string } | undefined,
    @Info('data') infoData: { userId?: string } | undefined,
    @Headers('x-user-id') headerUserId: string | undefined,
  ) {
    const userId = this.resolveUserId(user, infoData, headerUserId);
    return this.notificationService.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(
    @Param('id') id: string,
    @User() user: { userId?: string } | undefined,
    @Info('data') infoData: { userId?: string } | undefined,
    @Headers('x-user-id') headerUserId: string | undefined,
  ) {
    const userId = this.resolveUserId(user, infoData, headerUserId);
    return this.notificationService.markRead(userId, id);
  }

  @Post('read-all')
  readAll(
    @User() user: { userId?: string } | undefined,
    @Info('data') infoData: { userId?: string } | undefined,
    @Headers('x-user-id') headerUserId: string | undefined,
  ) {
    const userId = this.resolveUserId(user, infoData, headerUserId);
    return this.notificationService.readAll(userId);
  }
}
