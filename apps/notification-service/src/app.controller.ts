import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ServiceError, ErrorCodes } from '@common/core';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: process.env.SERVICE_NAME || 'Notification-Service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('debug/service-error')
  debugServiceError() {
    throw new ServiceError({
      code: ErrorCodes.INTERNAL,
      statusCode: 500,
      message: 'Debug error for testing',
    });
  }
  @Get('debug/service-error2')
  debugServiceError2() {
    throw new ServiceError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      statusCode: 401,
      message: 'Invalid email or password',
    });
  }
}
