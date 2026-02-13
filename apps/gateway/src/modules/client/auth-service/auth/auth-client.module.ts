import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { InternalJwtModule } from 'src/modules/internal-jwt/internal-jwt.module';
import { AuthClientController } from './auth-client.controller';
import { UserJwtStrategy } from 'src/modules/internal-jwt/strategy/user-jwt.strategy';

@Module({
  imports: [InternalJwtModule],
  providers: [AuthClientService, UserJwtStrategy],
  exports: [AuthClientService],
  controllers: [AuthClientController],
})
export class AuthClientModule {}
