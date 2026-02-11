import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NatsModule } from './modules/nats/nats.module';
import { APP_GUARD } from '@nestjs/core';
import { InternalJwtAuthGuard } from './share/strategy/jwt-auth.guard';
import { QueueModule } from './modules/queue/queue.module';
import { RolesModule } from './modules/roles/roles.module';

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
    QueueModule,
    RolesModule,
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
