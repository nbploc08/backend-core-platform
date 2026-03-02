import { Injectable } from '@nestjs/common';
import { NatsService, BaseJetstreamConsumer, ConsumerConfig, logger } from '@common/core';
import {
  NotificationCreatedSchema,
  WS_NOTIFICATION_NEW,
  NotificationNewPayload,
} from '@contracts/core';
import { CoreWebsocketGateway } from 'src/modules/websocket/websocket.gateway';

@Injectable()
export class NotificationJetstreamConsumer extends BaseJetstreamConsumer {
  constructor(
    natsService: NatsService,
    private readonly wsGateway: CoreWebsocketGateway,
  ) {
    super(natsService);
  }

  protected getConsumers(): ConsumerConfig[] {
    return [
      {
        streamName: 'NOTIFICATION_EVENT',
        durableName: 'gateway-notification-created',
        filterSubject: 'notification.created',
        handle: async (msg) => {
          const data = JSON.parse(msg.string());
          const payload = NotificationCreatedSchema.parse(data);

          const wsPayload: NotificationNewPayload = {
            notificationId: payload.notificationId,
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            createdAt: payload.actionCreatedAt,
            unreadCount: payload.unreadCount,
          };

          this.wsGateway.emitToUser(payload.userId, WS_NOTIFICATION_NEW, wsPayload);

          logger.info(
            { userId: payload.userId, notificationId: payload.notificationId, unreadCount: payload.unreadCount },
            'Pushed notification to WebSocket',
          );
        },
      },
    ];
  }
}
