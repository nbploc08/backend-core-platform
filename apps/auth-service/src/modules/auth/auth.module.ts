import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './passport/local.strategy';
import { InternalJwtStrategy } from './strategy/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
        secret: configService.get<string>('JWT_SECRET') || 'change-me',
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN') || 900,
          issuer: configService.get<string>('JWT_ISSUER') || 'auth-service',
          audience: configService.get<string>('JWT_AUDIENCE') || 'api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, InternalJwtStrategy],
})
export class AuthModule {}
