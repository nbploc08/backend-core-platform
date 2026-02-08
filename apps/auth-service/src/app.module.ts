import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NatsModule } from './modules/nats/nats.module';
import { APP_GUARD } from '@nestjs/core';
import { InternalJwtAuthGuard } from './modules/auth/strategy/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    NatsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: InternalJwtAuthGuard,
    },
  ],
})
export class AppModule {}
