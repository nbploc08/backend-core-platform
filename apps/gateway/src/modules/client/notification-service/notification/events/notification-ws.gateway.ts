import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { logger } from '@common/core';
import {
  WS_NOTIFICATION_READ,
  WS_NOTIFICATION_READ_ALL,
  WS_NOTIFICATION_UPDATED,
  NotificationReadRequestSchema,
  NotificationUpdatedPayload,
} from '@contracts/core';
import { CoreWebsocketGateway, SocketData, WS_GATEWAY_OPTIONS } from 'src/modules/websocket/websocket.gateway';
import { InternalJwtService } from 'src/modules/internal-jwt/internal-jwt.service';
import { NotificationService } from 'src/modules/client/notification-service/notification/notification.service';

@WebSocketGateway(WS_GATEWAY_OPTIONS)
export class NotificationWsGateway {
  constructor(
    private readonly wsGateway: CoreWebsocketGateway,
    private readonly notificationService: NotificationService,
    private readonly internalJwtService: InternalJwtService,
  ) {}

  @SubscribeMessage(WS_NOTIFICATION_READ)
  async handleNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const socketData = client.data as SocketData | undefined;
    if (!socketData?.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!this.wsGateway.checkRateLimit(socketData.userId)) {
      client.emit('error', { message: 'Rate limit exceeded, please slow down' });
      return;
    }

    const parsed = NotificationReadRequestSchema.safeParse(body);
    if (!parsed.success) {
      client.emit('error', { message: 'Invalid payload', errors: parsed.error.flatten() });
      return;
    }

    const { notificationId } = parsed.data;
    const requestId = randomUUID();
    const internalToken = `Bearer ${this.internalJwtService.signInternalToken({ userId: socketData.userId })}`;

    try {
      await this.notificationService.markRead(notificationId, internalToken, requestId);
      const { count } = await this.notificationService.unreadCount(internalToken, requestId);

      const payload: NotificationUpdatedPayload = {
        action: 'read',
        notificationId,
        unreadCount: count,
      };
      this.wsGateway.emitToUser(socketData.userId, WS_NOTIFICATION_UPDATED, payload);

      logger.info(
        { userId: socketData.userId, notificationId, unreadCount: count },
        'Notification marked as read via WS',
      );
    } catch (error) {
      logger.error({ userId: socketData.userId, notificationId, error }, 'Failed to mark notification as read');
      client.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  @SubscribeMessage(WS_NOTIFICATION_READ_ALL)
  async handleNotificationReadAll(@ConnectedSocket() client: Socket): Promise<void> {
    const socketData = client.data as SocketData | undefined;
    if (!socketData?.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!this.wsGateway.checkRateLimit(socketData.userId)) {
      client.emit('error', { message: 'Rate limit exceeded, please slow down' });
      return;
    }

    const requestId = randomUUID();
    const internalToken = `Bearer ${this.internalJwtService.signInternalToken({ userId: socketData.userId })}`;

    try {
      const { updated } = await this.notificationService.readAll(internalToken, requestId);

      const payload: NotificationUpdatedPayload = {
        action: 'read-all',
        unreadCount: 0,
      };
      this.wsGateway.emitToUser(socketData.userId, WS_NOTIFICATION_UPDATED, payload);

      logger.info(
        { userId: socketData.userId, updated },
        'All notifications marked as read via WS',
      );
    } catch (error) {
      logger.error({ userId: socketData.userId, error }, 'Failed to mark all notifications as read');
      client.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  }
}
