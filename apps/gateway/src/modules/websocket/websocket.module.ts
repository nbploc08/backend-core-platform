import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreWebsocketGateway } from './websocket.gateway';
import { SocketRegistryService } from './socket-registry.service';

@Module({
  imports: [ConfigModule],
  providers: [SocketRegistryService, CoreWebsocketGateway],
  exports: [CoreWebsocketGateway, SocketRegistryService],
})
export class WebsocketModule {}
