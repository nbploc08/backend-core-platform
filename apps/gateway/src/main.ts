import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpLoggerInterceptor, HttpExceptionFilter, TransformInterceptor } from '@common/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Standardize success response
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
