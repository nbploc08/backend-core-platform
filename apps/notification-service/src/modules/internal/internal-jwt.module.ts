import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { InternalJwtService } from './internal-jwt.service';
import { InternalJwtStrategy } from './internal-strategy/jwt.strategy';

@Module({
  imports: [ConfigModule, PassportModule],
  providers: [InternalJwtService, InternalJwtStrategy],
  exports: [InternalJwtService],
})
export class InternalJwtModule {}
