import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpLoggerInterceptor } from '@common/core';
import { HttpExceptionFilter } from '@common/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  // NATS: NatsModule (connect + stream EVENTS) + JetstreamModule (consumer user.registered)
  await app.listen(process.env.PORT ?? 3002);
}

bootstrap();
