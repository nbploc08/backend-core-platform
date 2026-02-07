import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { ErrorCodes, ServiceError } from '@common/core';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('health')
  health(@Req() req: any) {
    return { ok: true };
  }

  @Get('debug/service-error')
  debugServiceError() {
    throw new ServiceError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      statusCode: 999,
      message: 'Invalid email or password',
    });
  }
}
