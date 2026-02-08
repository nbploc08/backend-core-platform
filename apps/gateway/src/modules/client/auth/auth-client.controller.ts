import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Public, User } from '@common/core';
import { JwtAuthGuard } from './strategy/jwt-auth.guard';
import { AuthClientService } from './auth-client.service';

@Controller('client/auth')
@UseGuards(JwtAuthGuard)
export class AuthClientController {
  constructor(private readonly authClient: AuthClientService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@User() user: { userId: string }, @Req() req: Request & { requestId?: string }) {
    const authHeader = req.headers['authorization'] as string;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;
    const requestId = req.requestId ?? '';
    return this.authClient.getProfileByUserId(user.userId, requestId);
  }
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: any, @Req() req: Request) {
    return this.authClient.login(loginDto, req.headers['x-request-id'] as string);
  }
}
