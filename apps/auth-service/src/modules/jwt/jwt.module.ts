import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { InternalJwtService } from './jwt.service';
import { InternalJwtStrategy, CombinedJwtStrategy } from './strategy/jwt.strategy';
import { InternalJwtAuthGuard, CombinedJwtAuthGuard } from './strategy/jwt-auth.guard';

@Module({
  imports: [ConfigModule, PassportModule],
  providers: [
    InternalJwtService,
    // Strategies
    InternalJwtStrategy, // Backward compatible - chỉ accept Internal JWT
    CombinedJwtStrategy, // Mới - accept cả Internal JWT và User JWT
    // Guards (export để các module khác có thể inject)
    InternalJwtAuthGuard,
    CombinedJwtAuthGuard,
  ],
  exports: [InternalJwtService, InternalJwtAuthGuard, CombinedJwtAuthGuard],
})
export class JwtModule {}
