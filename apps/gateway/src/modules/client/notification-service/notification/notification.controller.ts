import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Req } from '@nestjs/common';
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

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Headers('authorization') auth: string,
    @Req() req: any,
  ) {
    return this.notificationService.create(createNotificationDto, auth, req.requestId);
  }

  @Get()
  findAll(@Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.findAll(auth, req.requestId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.findOne(id, auth, req.requestId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Headers('authorization') auth: string,
    @Req() req: any,
  ) {
    return this.notificationService.update(id, updateNotificationDto, auth, req.requestId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('authorization') auth: string, @Req() req: any) {
    return this.notificationService.remove(id, auth, req.requestId);
  }
}
