import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalJwtService } from './internal-jwt.service';
import { InternalJwtStrategy } from './internal-strategy/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
    imports: [ConfigModule, PassportModule],
      providers: [InternalJwtService, InternalJwtStrategy],
      exports: [InternalJwtService],
})
export class InternalJwtModule {}
