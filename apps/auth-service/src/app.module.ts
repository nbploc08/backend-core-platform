import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NatsModule } from '@common/core';
import { APP_GUARD } from '@nestjs/core';
import { CombinedJwtAuthGuard } from './modules/jwt/strategy/jwt-auth.guard';
import { JwtModule } from './modules/jwt/jwt.module';
import { QueueModule } from './modules/queue/queue.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionGuard, PermissionModule, TokenTypeGuard } from '@common/core';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    NatsModule.forRoot({
      serviceName: 'auth-service',
      streams: [
        { name: 'AUTH_EVENT', subjects: ['user.*', 'notification.*'] },
      ],
    }),
    QueueModule,
    RolesModule,
    PermissionModule,
    JwtModule, // Đăng ký CombinedJwtStrategy và InternalJwtStrategy
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CombinedJwtAuthGuard,
    },
    {
      provide: APP_GUARD, //
      useClass: PermissionGuard, // Permission check
    },
    {
      provide: APP_GUARD,
      useClass: TokenTypeGuard, // Internal only check
    },
  ],
})
export class AppModule {}
