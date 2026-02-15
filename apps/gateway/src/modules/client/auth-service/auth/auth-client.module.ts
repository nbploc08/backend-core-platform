import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { InternalJwtModule } from 'src/modules/internal-jwt/internal-jwt.module';
import { AuthClientController } from './auth-client.controller';
import { UserJwtStrategy } from 'src/modules/internal-jwt/strategy/user-jwt.strategy';
import { IdempotencyService } from 'src/modules/share/idempotency.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Module({
  imports: [InternalJwtModule],
  providers: [AuthClientService, UserJwtStrategy, IdempotencyService, PrismaService],
  exports: [AuthClientService],
  controllers: [AuthClientController],
})
export class AuthClientModule {}
