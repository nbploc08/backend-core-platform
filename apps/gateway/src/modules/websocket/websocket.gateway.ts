import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { logger } from '@common/core';
import { SocketRegistryService } from './socket-registry.service';
import {
  WS_NOTIFICATION_READ,
  WS_NOTIFICATION_READ_ALL,
  NotificationReadRequestSchema,
} from '@contracts/core';

/**
 * Payload từ JWT của user (giống như trong UserJwtStrategy)
 */
interface JwtPayload {
  sub: string; // userId
  email: string;
  permVersion: number;
  iat: number;
  exp: number;
}

/**
 * Dữ liệu được attach vào socket sau khi auth thành công
 */
interface SocketData {
  userId: string;
  email: string;
  authenticated: boolean;
}

/**
 * WebSocket Gateway - Điểm vào cho tất cả kết nối WebSocket
 *
 * @WebSocketGateway() decorator config:
 * - cors: cho phép frontend từ domain khác kết nối
 * - namespace: (optional) tách biệt các loại WS connections
 *
 * Implements 3 interfaces:
 * - OnGatewayInit: Gọi khi WS server khởi tạo xong
 * - OnGatewayConnection: Gọi khi có client kết nối
 * - OnGatewayDisconnect: Gọi khi client ngắt kết nối
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Production: thay bằng domain cụ thể
    credentials: true,
  },
  // namespace: '/notifications', // Có thể thêm namespace nếu cần
})
export class NotificationWebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // Server instance - dùng để emit events đến clients
  @WebSocketServer()
  server: Server;

  // JWT secret để verify token
  private readonly jwtSecret: string;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;

  constructor(
    private readonly socketRegistry: SocketRegistryService,
    private readonly configService: ConfigService,
  ) {
    // Lấy config JWT (giống như trong UserJwtStrategy)
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'change-me';
    this.jwtIssuer = this.configService.get<string>('JWT_ISSUER') || 'auth-service';
    this.jwtAudience = this.configService.get<string>('JWT_AUDIENCE') || 'api';
  }

  /**
   * Gọi sau khi WebSocket server khởi tạo xong
   */
  afterInit() {
    logger.info('WebSocket Gateway initialized');
  }

  /**
   * Gọi khi có client kết nối
   *
   * Flow xác thực:
   * 1. Client kết nối với token trong query hoặc header
   * 2. Server verify JWT
   * 3. Nếu OK: đăng ký vào registry, cho phép nhận events
   * 4. Nếu fail: ngắt kết nối
   *
   * @param client - Socket instance của client
   */
  async handleConnection(client: Socket) {
    try {
      // Lấy token từ query string hoặc header
      // Client có thể gửi: ws://localhost:3000?token=xxx
      // Hoặc trong header: Authorization: Bearer xxx
      const token = this.extractToken(client);

      if (!token) {
        logger.warn({ socketId: client.id }, 'WS connection without token - disconnecting');
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = this.verifyToken(token);

      if (!payload) {
        logger.warn({ socketId: client.id }, 'WS connection with invalid token - disconnecting');
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Auth thành công - lưu thông tin user vào socket
      const socketData: SocketData = {
        userId: payload.sub,
        email: payload.email,
        authenticated: true,
      };
      client.data = socketData;

      // Đăng ký vào registry
      this.socketRegistry.register(payload.sub, client.id);

      // Thông báo cho client biết đã auth thành công
      client.emit('authenticated', {
        userId: payload.sub,
        message: 'Connected successfully',
      });

      logger.info(
        {
          socketId: client.id,
          userId: payload.sub,
          onlineUsers: this.socketRegistry.getOnlineUsersCount(),
          totalConnections: this.socketRegistry.getTotalConnectionsCount(),
        },
        'WS client connected and authenticated',
      );
    } catch (error) {
      logger.error({ socketId: client.id, error }, 'WS connection error');
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  /**
   * Gọi khi client ngắt kết nối
   */
  handleDisconnect(client: Socket) {
    // Lấy userId từ socket data (nếu đã auth)
    const socketData = client.data as SocketData | undefined;

    // Hủy đăng ký khỏi registry
    this.socketRegistry.unregister(client.id);

    logger.info(
      {
        socketId: client.id,
        userId: socketData?.userId,
        onlineUsers: this.socketRegistry.getOnlineUsersCount(),
        totalConnections: this.socketRegistry.getTotalConnectionsCount(),
      },
      'WS client disconnected',
    );
  }

  /**
   * Lấy token từ client connection
   * Hỗ trợ nhiều cách gửi token:
   * 1. Query string: ?token=xxx
   * 2. Auth header: Authorization: Bearer xxx
   * 3. Handshake auth: socket.io auth object
   */
  private extractToken(client: Socket): string | null {
    // Cách 1: Query string
    const queryToken = client.handshake.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Cách 2: Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Cách 3: Socket.io auth object (client gửi trong options)
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    return null;
  }

  /**
   * Verify JWT token
   * @returns payload nếu valid, null nếu invalid
   */
  private verifyToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      }) as JwtPayload;

      return payload;
    } catch (error) {
      logger.debug({ error }, 'JWT verification failed');
      return null;
    }
  }

  /**
   * Handler cho message 'ping' từ client
   * Dùng để test connection và giữ connection alive
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  /**
   * Handler cho message 'notification:read' từ client
   * Dùng khi user đánh dấu đã đọc 1 notification
   */
  @SubscribeMessage(WS_NOTIFICATION_READ)
  handleNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const socketData = client.data as SocketData | undefined;
    if (!socketData?.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const parsed = NotificationReadRequestSchema.safeParse(body);
    if (!parsed.success) {
      client.emit('error', { message: 'Invalid payload', errors: parsed.error.flatten() });
      return;
    }

    logger.info(
      { userId: socketData.userId, notificationId: parsed.data.notificationId },
      'User requested to mark notification as read',
    );

    // TODO: Call notification-service to mark as read (via HTTP or NATS)
  }

  /**
   * Handler cho message 'notification:read-all' từ client
   * Dùng khi user đánh dấu đã đọc tất cả notifications
   */
  @SubscribeMessage(WS_NOTIFICATION_READ_ALL)
  handleNotificationReadAll(@ConnectedSocket() client: Socket): void {
    const socketData = client.data as SocketData | undefined;
    if (!socketData?.authenticated) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    logger.info({ userId: socketData.userId }, 'User requested to mark all notifications as read');

    // TODO: Call notification-service to mark all as read (via HTTP or NATS)
  }

  /**
   * Gửi event đến tất cả sockets của một user
   * Dùng khi cần push notification đến user
   *
   * @param userId - ID của user cần gửi
   * @param event - Tên event
   * @param data - Dữ liệu gửi kèm
   */
  emitToUser(userId: string, event: string, data: any): void {
    const socketIds = this.socketRegistry.getSocketsByUser(userId);

    if (socketIds.size === 0) {
      logger.debug({ userId, event }, 'User not online, skipping emit');
      return;
    }

    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, data);
    }

    logger.debug({ userId, event, socketsCount: socketIds.size }, 'Emitted to user');
  }

  /**
   * Broadcast event đến tất cả connected clients
   * Dùng cho system-wide announcements
   */
  broadcast(event: string, data: any): void {
    this.server.emit(event, data);
  }
}
