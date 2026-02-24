import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './modules/internal-jwt/strategy/jwt-auth.guard';
import { AuthClientModule } from './modules/client/auth-service/auth/auth-client.module';
import { RoleClientModule } from './modules/client/auth-service/role/role-client.module';
import { NotificationModule } from './modules/client/notification-service/notification/notification.module';
import { PermissionGuard, PermissionModule } from '@common/core';
import { PrismaModule } from './modules/prisma/prisma.module';
import { WebsocketModule } from './modules/websocket';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),

    AuthClientModule,
    RoleClientModule,
    NotificationModule,
    PermissionModule,
    PrismaModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD, //
      useClass: PermissionGuard, // Permission check
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
