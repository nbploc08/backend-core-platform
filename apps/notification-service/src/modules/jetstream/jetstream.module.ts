import { Module } from '@nestjs/common';
import { JetstreamConsumerService } from './jetstream-consumer.service';
import { NotificationModule } from 'src/modules/notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [JetstreamConsumerService],
})
export class JetstreamModule {}
