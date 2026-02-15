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
import { Cookies, Public, User } from '@common/core';
import { JwtAuthGuard } from 'src/modules/internal-jwt/strategy/jwt-auth.guard';
import { AuthClientService } from './auth-client.service';

function getRequestId(req: Request & { requestId?: string }): string {
  const rid = req.requestId ?? req.headers['x-request-id'];
  return Array.isArray(rid) ? (rid[0] ?? '') : (rid ?? '');
}

@Controller('client/auth')
@UseGuards(JwtAuthGuard)
export class AuthClientController {
  constructor(private readonly authClient: AuthClientService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@User() user: { userId: string }, @Req() req: Request & { requestId?: string }) {
    return this.authClient.getProfileByUserId(
      user.userId,
      getRequestId(req),
      req.headers.authorization,
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: { email?: string; password?: string; username?: string },
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.login(loginDto, getRequestId(req), res);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: Record<string, unknown>,
    @Req() req: Request & { requestId?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.authClient.register(registerDto, getRequestId(req), req.path, idempotencyKey);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() verifyDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.verify(verifyDto, getRequestId(req));
  }

  @Public()
  @Post('register/verify/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Body() confirmDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.confirm(confirmDto, getRequestId(req));
  }

  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  async resendCode(@Body('email') email: string, @Req() req: Request & { requestId?: string }) {
    return this.authClient.resendCode(email, getRequestId(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Cookies('refreshToken') refreshToken: string,
    @Cookies('deviceId') deviceId: string,
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.authClient.refresh(refreshToken ?? '', deviceId ?? '', getRequestId(req), res);
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
      getRequestId(req),
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
      getRequestId(req),
      res,
      req.headers.authorization,
    );
  }

  @Public()
  @Post('forgot/password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: { email: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPassword(forgotPasswordDto, getRequestId(req));
  }

  @Public()
  @Post('forgot/password/verify')
  @HttpCode(HttpStatus.OK)
  async forgotPasswordVerify(
    @Body() forgotPasswordVerifyDto: { email: string; code: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPasswordVerify(forgotPasswordVerifyDto, getRequestId(req));
  }
  @Public()
  @Post('forgot/password/reset')
  @HttpCode(HttpStatus.OK)
  async forgotPasswordReset(
    @Body() forgotPasswordResetDto: { email: string; code: string; password: string },
    @Req() req: Request & { requestId?: string },
  ) {
    return this.authClient.forgotPasswordReset(forgotPasswordResetDto, getRequestId(req));
  }
}
