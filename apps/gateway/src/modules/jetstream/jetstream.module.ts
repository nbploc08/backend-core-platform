import { Module } from '@nestjs/common';
import { JetstreamConsumerService } from './jetstream-consumer.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [JetstreamConsumerService],
})
export class JetstreamModule {}
