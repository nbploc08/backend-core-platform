import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ErrorCodes, Public, ServiceError } from '@common/core';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('health')
  @Public()
  health() {
    return { ok: true };
  }

  @Get('debug/service-error')
  @Public()
  debugServiceError() {
    throw new ServiceError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      statusCode: 999,
      message: 'Invalid email or password',
    });
  }
}
