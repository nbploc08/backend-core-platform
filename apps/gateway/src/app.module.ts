import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestIdMiddleware } from './middlewares/request-id.middleware';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './modules/client/auth/strategy/jwt-auth.guard';
import { AuthClientModule } from './modules/client/auth/auth-client.module';
import { RoleClientModule } from './modules/client/auth-service/role/role-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),

    AuthClientModule,
    RoleClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
