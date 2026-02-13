import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { InternalJwtModule } from 'src/modules/internal-jwt/internal-jwt.module';

@Module({
  imports: [InternalJwtModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
