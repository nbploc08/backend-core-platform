import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalJwtService } from './internal-jwt.service';

@Module({
  imports: [ConfigModule],
  providers: [InternalJwtService],
  exports: [InternalJwtService],
})
export class InternalJwtModule {}
