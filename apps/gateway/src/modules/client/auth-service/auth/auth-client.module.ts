import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { InternalJwtModule } from 'src/modules/internal-jwt/internal-jwt.module';
import { AuthClientController } from './auth-client.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { UserJwtStrategy } from 'src/modules/internal-jwt/strategy/user-jwt.strategy';

@Module({
  imports: [
    InternalJwtModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'change-me',
        signOptions: {
          issuer: config.get<string>('JWT_ISSUER') || 'auth-service',
          audience: config.get<string>('JWT_AUDIENCE') || 'api',
        },
      }),
    }),
  ],
  providers: [AuthClientService, UserJwtStrategy],
  exports: [AuthClientService],
  controllers: [AuthClientController],
})
export class AuthClientModule {}
