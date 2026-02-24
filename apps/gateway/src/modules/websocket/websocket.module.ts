import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationWebsocketGateway } from './websocket.gateway';
import { SocketRegistryService } from './socket-registry.service';

/**
 * WebSocket Module
 *
 * Module này gom tất cả các components liên quan đến WebSocket:
 * - SocketRegistryService: Quản lý danh sách connections
 * - NotificationWebsocketGateway: Xử lý kết nối và events
 *
 * Export NotificationWebsocketGateway để các module khác có thể:
 * - Inject và gọi emitToUser() để push notifications
 */
@Module({
  imports: [
    ConfigModule, // Để đọc JWT config
  ],
  providers: [
    SocketRegistryService, // Đăng ký service quản lý connections
    NotificationWebsocketGateway, // Đăng ký WebSocket gateway
  ],
  exports: [
    NotificationWebsocketGateway, // Export để module khác có thể inject
    SocketRegistryService, // Export nếu cần kiểm tra user online status
  ],
})
export class WebsocketModule {}
