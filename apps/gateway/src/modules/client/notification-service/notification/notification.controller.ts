import { Controller, Get, Post, Body, Param, Query, Headers, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Public, RateLimit } from '@common/core';

@Controller('client/notification')
@RateLimit({ prefix: 'api:notification', limit: 60, window: 60, keySource: 'userId' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  @Public()
  @Get('healthz')
  ping() {
    return this.notificationService.ping();
  }

  @Post()
  @RateLimit({ prefix: 'api:notification:create', limit: 10, window: 60, keySource: 'userId' })
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
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.notificationService.findAll(auth, req.requestId, page, limit, sortBy, sortOrder);
  }

  @Get('unread-count')
  unreadCount(@Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.unreadCount(auth, req.requestId);
  }

  @Post(':id/read')
  @RateLimit({ prefix: 'api:notification:read', limit: 30, window: 60, keySource: 'userId' })
  markRead(@Param('id') id: string, @Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.markRead(id, auth, req.requestId);
  }

  @Post('read-all')
  @RateLimit({ prefix: 'api:notification:read-all', limit: 10, window: 60, keySource: 'userId' })
  readAll(@Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.readAll(auth, req.requestId);
  }
}
