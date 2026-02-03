import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('health')
  health(@Req() req: any) {
    console.log({ requestId: req.requestId, msg: 'health called' });
    return { ok: true };
  }
}
