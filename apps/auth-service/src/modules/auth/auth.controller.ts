import { Controller, Post, Body, HttpCode, HttpStatus, Query, Param, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyRegisterDto } from './dto/verifyRegister.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('register/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Query() verifyDto: VerifyRegisterDto) {
    return this.authService.verify(verifyDto);
  }
}
