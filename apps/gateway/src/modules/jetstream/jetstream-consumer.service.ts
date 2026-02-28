import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { NatsService, BaseJetstreamConsumer, ConsumerConfig, logger } from '@common/core';
import { NotificationCreatedSchema } from '@contracts/core';
import { NotificationWebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class JetstreamConsumerService extends BaseJetstreamConsumer {
  constructor(
    natsService: NatsService,
    @Inject(forwardRef(() => NotificationWebsocketGateway))
    private readonly wsGateway: NotificationWebsocketGateway,
  ) {
    super(natsService);
  }

  protected getConsumers(): ConsumerConfig[] {
    return [
      {
        streamName: 'NOTIFICATION_EVENT',
        durableName: 'notification-created',
        filterSubject: 'notification.created',
        handle: async (msg) => {
          const data = JSON.parse(msg.string());
          const payload = NotificationCreatedSchema.parse(data);

          this.wsGateway.emitToUser(payload.userId, 'notification:new', {
            notificationId: payload.notificationId,
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            createdAt: payload.actionCreatedAt,
          });

          logger.info(
            { userId: payload.userId, notificationId: payload.notificationId },
            'Pushed notification to WebSocket',
          );
        },
      },
    ];
  }
}
