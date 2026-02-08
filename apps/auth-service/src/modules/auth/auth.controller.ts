import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  Header,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyRegisterDto } from './dto/verifyRegister.dto';
import { LocalAuthGuard } from './passport/local-auth.guard';
import { Cookies, Public, User } from '@common/core';
import type { UserInterface } from '../../entities/user.entities';

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function verifyConfirmHtml(email: string, code: string): string {
  const e = escapeHtmlAttr(email);
  const c = escapeHtmlAttr(code);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verifying...</title></head><body><p>Verifying your email...</p><form id="f" method="POST" action="/auth/register/verify"><input type="hidden" name="email" value="${e}"><input type="hidden" name="code" value="${c}"></form><script>document.getElementById('f').submit();</script></body></html>`;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() verifyDto: VerifyRegisterDto) {
    return this.authService.verify(verifyDto);
  }

  @Get('register/verify/confirm')
  @Header('Content-Type', 'text/html; charset=utf-8')
  confirmPage(@Query() verifyDto: VerifyRegisterDto, @Res() res: Response): void {
    const html = verifyConfirmHtml(verifyDto.email ?? '', verifyDto.code ?? '');
    res.send(html);
  }
  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  async resend(@Body('email') email: string) {
    return this.authService.resendCode(email);
  }

  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(req.user, res, req);
  }
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Cookies('refreshToken') refreshToken: string,
    @Cookies('deviceId') deviceId: string,
    @Res({ passthrough: true }) response: Response,
    @Request() req,
  ) {
    return this.authService.refresh(refreshToken, deviceId, response, req);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@User() user: UserInterface) {
    return this.authService.info(user);
  }

  @Post('logout-device')
  @HttpCode(HttpStatus.OK)
  async logoutDevice(
    @Cookies('deviceId') deviceId: string,
    @Res({ passthrough: true }) response: Response,
    @User() user: UserInterface,
    @Cookies('refreshToken') refreshToken: string,
  ) {
    return this.authService.logoutDevice(deviceId, response, user, refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Res({ passthrough: true }) response: Response, @User() user: UserInterface) {
    return this.authService.logoutAll(response, user);
  }
}
