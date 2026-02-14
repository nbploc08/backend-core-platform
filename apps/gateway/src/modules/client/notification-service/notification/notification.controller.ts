import { Controller, Get, Post, Body, Param, Query, Headers, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Public, RequirePermission, PermissionCode } from '@common/core';

@Controller('client/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  @Public()
  @Get('healthz')
  ping() {
    return this.notificationService.ping();
  }

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Headers('authorization') auth: string,
    @Req() req: any,
  ) {
    return this.notificationService.create(createNotificationDto, auth, req.requestId);
  }

  @Get()
  findAll(
    @Headers('authorization') auth: string,
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.findAll(auth, req.requestId, page, limit);
  }

  @Get('unread-count')
  unreadCount(@Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.unreadCount(auth, req.requestId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.markRead(id, auth, req.requestId);
  }

  @Post('read-all')
  readAll(@Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.readAll(auth, req.requestId);
  }
}
