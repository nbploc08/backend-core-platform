import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpLoggerInterceptor } from '@common/core';
import { HttpExceptionFilter } from '@common/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // HTTP app (nếu sau này cần REST/debug)
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  // Microservice NATS để lắng nghe event từ auth-service
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL || 'nats://localhost:4222'],
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3002);
}

bootstrap();
