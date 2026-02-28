import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsModule } from '@common/core';
import { NotificationModule } from './modules/notification/notification.module';
import { MailsModule } from './modules/mails/mails.module';
import { JetstreamModule } from './modules/jetstream/jetstream.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { APP_GUARD } from '@nestjs/core';
import { PermissionModule, PermissionGuard } from '@common/core';
import { CombinedJwtAuthGuard } from './modules/jwt/strategy/jwt-auth.guard';
import { JwtModule } from './modules/jwt/jwt.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    NatsModule.forRoot({
      serviceName: 'notification-service',
      streams: [
        { name: 'AUTH_EVENT', subjects: ['user.*'] },
        { name: 'NOTIFICATION_EVENT', subjects: ['notification.*'] },
      ],
    }),
    NotificationModule,
    MailsModule,
    JetstreamModule,
    JobsModule,
    JwtModule,
    PrismaModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CombinedJwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
