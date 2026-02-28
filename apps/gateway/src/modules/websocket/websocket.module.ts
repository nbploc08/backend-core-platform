import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationWebsocketGateway } from './websocket.gateway';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationModule } from '../client/notification-service/notification/notification.module';
import { InternalJwtModule } from '../internal-jwt/internal-jwt.module';

@Module({
  imports: [
    ConfigModule,
    NotificationModule,
    InternalJwtModule,
  ],
  providers: [
    SocketRegistryService,
    NotificationWebsocketGateway,
  ],
  exports: [
    NotificationWebsocketGateway,
    SocketRegistryService,
  ],
})
export class WebsocketModule {}
