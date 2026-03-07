import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Cookies, Public, RateLimit, User } from '@common/core';
import { JwtAuthGuard } from 'src/modules/internal-jwt/strategy/jwt-auth.guard';
import { AuthClientService } from './auth-client.service';
import { LoginDto } from './dto/login.dto';

@Controller('client/auth')
@UseGuards(JwtAuthGuard)
export class AuthClientController {
  constructor(private readonly authClient: AuthClientService) {}
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: Request & { requestId?: string }) {
    return this.authClient.getProfileByUserId(req.requestId || '', req.headers.authorization);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit([
    { prefix: 'login:ip', limit: 10, window: 60, keySource: 'ip' },
    { prefix: 'login:email', limit: 5, window: 60, keySource: 'body.email' },
  ])
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.login(loginDto, req.requestId || '', res);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ prefix: 'register:ip', limit: 5, window: 60, keySource: 'ip' })
  async register(
    @Body() registerDto: Record<string, unknown>,
    @Req() req: Request & { requestId?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.authClient.register(registerDto, req.requestId || '', req.path, idempotencyKey);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() verifyDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.verify(verifyDto, req.requestId || '');
  }

  @Public()
  @Post('register/verify/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Body() confirmDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.confirm(confirmDto, req.requestId || '');
  }

  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @RateLimit([
    { prefix: 'resend:ip', limit: 5, window: 60, keySource: 'ip' },
    { prefix: 'resend:email', limit: 2, window: 60, keySource: 'body.email' },
  ])
  async resendCode(@Body('email') email: string, @Req() req: Request & { requestId?: string }) {
    return this.authClient.resendCode(email, req.requestId || '');
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ prefix: 'refresh:ip', limit: 20, window: 60, keySource: 'ip' })
  async refresh(
    @Cookies('refreshToken') refreshToken: string,
    @Cookies('deviceId') deviceId: string,
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.refresh(refreshToken ?? '', deviceId ?? '', req.requestId || '', res);
  }

  @Post('logout-device')
  @HttpCode(HttpStatus.OK)
  async logoutDevice(
    @Cookies('deviceId') deviceId: string,
    @Cookies('refreshToken') refreshToken: string,
    @User() user: { userId: string },
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.logoutDevice(
      deviceId ?? '',
      refreshToken ?? '',
      user.userId,
      req.requestId || '',
      res,
      req.headers.authorization,
    );
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @User() user: { userId: string },
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.logoutAll(
      user.userId,
      req.requestId || '',
      res,
      req.headers.authorization,
    );
  }

  @Public()
  @Post('forgot/password')
  @HttpCode(HttpStatus.OK)
  @RateLimit([
    { prefix: 'forgot:ip', limit: 5, window: 600, keySource: 'ip' },
    { prefix: 'forgot:email', limit: 2, window: 600, keySource: 'body.email' },
  ])
  async forgotPassword(
    @Body() forgotPasswordDto: { email: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPassword(forgotPasswordDto, req.requestId || '');
  }

  @Public()
  @Post('forgot/password/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ prefix: 'forgot-verify:ip', limit: 10, window: 600, keySource: 'ip' })
  async forgotPasswordVerify(
    @Body() forgotPasswordVerifyDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPasswordVerify(forgotPasswordVerifyDto, req.requestId || '');
  }
  @Public()
  @Post('forgot/password/reset')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ prefix: 'forgot-reset:ip', limit: 5, window: 600, keySource: 'ip' })
  async forgotPasswordReset(
    @Body() forgotPasswordResetDto: { email: string; code: string; password: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPasswordReset(forgotPasswordResetDto, req.requestId || '');
  }
}
