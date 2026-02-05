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

  @Get('debug/service-error')
  debugServiceError() {
    throw new ServiceError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      statusCode: 401,
      message: 'Invalid email or password',
    });
  }
}
