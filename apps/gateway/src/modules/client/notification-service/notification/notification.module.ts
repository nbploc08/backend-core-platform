import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationWsGateway, NotificationJetstreamConsumer } from './events';
import { InternalJwtModule } from 'src/modules/internal-jwt/internal-jwt.module';
import { WebsocketModule } from 'src/modules/websocket/websocket.module';

@Module({
  imports: [InternalJwtModule, WebsocketModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationWsGateway, NotificationJetstreamConsumer],
  exports: [NotificationService],
})
export class NotificationModule {}
