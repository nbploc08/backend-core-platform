import { BadRequestException, Injectable } from '@nestjs/common';
import {
  NatsService,
  BaseJetstreamConsumer,
  ConsumerConfig,
  logger,
  ServiceError,
  getReqLogger,
  ErrorCodes,
} from '@common/core';
import { UserRegisteredSchema } from '@contracts/core';
import { NotificationService } from 'src/modules/notification/notification.service';
import { email } from 'zod';

@Injectable()
export class JetstreamConsumerService extends BaseJetstreamConsumer {
  constructor(
    natsService: NatsService,
    private readonly notificationService: NotificationService,
  ) {
    super(natsService);
  }

  protected getConsumers(): ConsumerConfig[] {
    return [
      {
        streamName: 'AUTH_EVENT',
        durableName: 'notification-user-registered',
        filterSubject: 'user.registered',
        handle: async (msg) => {
          const data = JSON.parse(msg.string());
          const payload = UserRegisteredSchema.parse(data);
          await this.notificationService.sendMailRegis(payload);
          // await this.notificationService.createNoti({
          //   userId: payload.userId,
          //   type: 'notification-user-registered',
          //   title: 'Chào mừng bạn đến với hệ thống',
          //   body: `Tài khoản ${payload.email} đã được tạo thành công.`,
          //   data: { email: payload.email, actionCreatedAt: payload.createdAt },
          // });
        },
      },
    ];
  }
}
