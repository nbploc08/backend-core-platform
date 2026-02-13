import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsModule } from './modules/nats/nats.module';
import { NotificationModule } from './modules/notification/notification.module';
import { MailsModule } from './modules/mails/mails.module';
import { JetstreamModule } from './modules/jetstream/jetstream.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { APP_GUARD } from '@nestjs/core';
import { PermissionModule, PermissionGuard } from '@common/core';
import { InternalJwtAuthGuard } from './modules/internal/internal-strategy/jwt-auth.guard';
import { InternalJwtModule } from './modules/internal/internal-jwt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    NatsModule,
    NotificationModule,
    MailsModule,
    JetstreamModule,
    JobsModule,
    InternalJwtModule,
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
