import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { logger } from '@common/core';
import { SocketRegistryService } from './socket-registry.service';

export interface JwtPayload {
  sub: string;
  email: string;
  permVersion: number;
  iat: number;
  exp: number;
}

export interface SocketData {
  userId: string;
  email: string;
  authenticated: boolean;
}

export const WS_GATEWAY_OPTIONS = {
  cors: {
    origin: '*',
    credentials: true,
  },
};

@WebSocketGateway(WS_GATEWAY_OPTIONS)
export class CoreWebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly jwtSecret: string;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;

  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();
  private static readonly MAX_MESSAGES_PER_SECOND = 10;

  constructor(
    private readonly socketRegistry: SocketRegistryService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'change-me';
    this.jwtIssuer = this.configService.get<string>('JWT_ISSUER') || 'auth-service';
    this.jwtAudience = this.configService.get<string>('JWT_AUDIENCE') || 'api';
  }

  afterInit() {
    logger.info('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        logger.warn({ socketId: client.id }, 'WS connection without token - disconnecting');
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.verifyToken(token);

      if (!payload) {
        logger.warn({ socketId: client.id }, 'WS connection with invalid token - disconnecting');
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const socketData: SocketData = {
        userId: payload.sub,
        email: payload.email,
        authenticated: true,
      };
      client.data = socketData;

      this.socketRegistry.register(payload.sub, client.id);

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

  handleDisconnect(client: Socket) {
    const socketData = client.data as SocketData | undefined;

    this.socketRegistry.unregister(client.id);

    if (socketData?.userId && !this.socketRegistry.isUserOnline(socketData.userId)) {
      this.rateLimits.delete(socketData.userId);
    }

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

  private extractToken(client: Socket): string | null {
    const queryToken = client.handshake.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    return null;
  }

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
   * Public — các module khác gọi để kiểm tra rate limit trước khi xử lý WS message.
   * Trả true nếu cho phép, false nếu vượt giới hạn.
   */
  checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(userId);

    if (!limit || now > limit.resetAt) {
      this.rateLimits.set(userId, { count: 1, resetAt: now + 1000 });
      return true;
    }

    if (limit.count >= CoreWebsocketGateway.MAX_MESSAGES_PER_SECOND) {
      return false;
    }

    limit.count++;
    return true;
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  /**
   * Public — gửi event đến tất cả sockets của một user (multi-tab broadcast).
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
   * Public — broadcast event đến tất cả connected clients.
   */
  broadcast(event: string, data: any): void {
    this.server.emit(event, data);
  }
}
