import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NatsService } from '../nats/nats.service';
import { RegisterDto } from './dto/register.dto';
import {
  encrypt,
  ErrorCodes,
  getEncryptKey,
  hashPassword,
  logger,
  ServiceError,
  verifyPassword,
} from '@common/core';
import { USER_REGISTERED, UserRegisteredSchema } from '@contracts/core';
import { RegisterResponseDto } from './dto/registerRes.dto';
import { VerifyRegisterDto } from './dto/verifyRegister.dto';
import { loginResponseDto } from './dto/loginRes.dto';
import { UAParser } from 'ua-parser-js';
import { randomUUID } from 'crypto';
import { UserInterface } from '../../entities/user.entities';
import { JwtService } from '@nestjs/jwt';
import { InfoUserDto } from '../users/dto/infoUser.dto';
import { QueueService } from '../queue/queue.service';
import { PASSWORD_RESET_REQUESTED, PasswordResetRequestedSchema } from '@contracts/core';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly natsService: NatsService,
    private readonly jwtService: JwtService,
    private readonly queueService: QueueService,
  ) {}
  private async getDeviceData(req: any): Promise<any> {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    // libi UAParser
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    const deviceName = `${ua.browser.name} on ${ua.os.name}`;

    const dataDevice = {
      ip,
      deviceName,
      userAgent,
    };
    return dataDevice;
  }
  private async issueTokens(
    user: UserInterface,
    response: any,
    dataDevice: any,
    deviceId: string,
    refreshTokenOld?: string,
  ): Promise<loginResponseDto> {
    const payload = {
      email: user.email,
      sub: user.id,
      permVersion: user.permVersion,
    };

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN) || 60 * 60 * 24 * 30,
    });
    await this.usersService.saveRefreshToken(
      user.id,
      refreshToken,
      dataDevice,
      deviceId,
      refreshTokenOld,
    );
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: Number(process.env.JWT_EXPIRES_IN) || 900,
    });

    await response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN) * 1000 || 60 * 60 * 24 * 30 * 1000,
    });

    await response.cookie('deviceId', deviceId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return {
      id: user.id,
      email: user.email,
      access_token: accessToken,
    } as loginResponseDto;
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const user = await this.usersService.create(dto);

    const eventPayload = {
      userId: user.userId,
      email: user.email,
      code: user.code,
      createdAt: user.createdAt.toISOString(),
    };

    const validatedPayload = UserRegisteredSchema.parse(eventPayload);

    // await this.natsService.publish(USER_REGISTERED, validatedPayload);
    await this.queueService.sendVerifyCode(validatedPayload);

    logger.info(
      {
        action: 'user.registered',
        userId: user.userId,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      'User registered successfully',
    );

    return {
      userId: user.userId,
      email: user.email,
      createdAt: user.createdAt,
    } as RegisterResponseDto;
  }

  async verify(dto: VerifyRegisterDto): Promise<boolean> {
    try {
      return await this.usersService.veryfiRegister(dto.email, dto.code);
    } catch {
      logger.error({ dto }, 'Failed to verify user');
      throw new BadRequestException('Failed to verify user');
    }
  }

  async login(user: UserInterface, response: any, req: any): Promise<loginResponseDto> {
    const emailForLog = user?.email;
    try {
      const dataDevice = await this.getDeviceData(req);
      const deviceId = randomUUID();
      const isActive = await this.usersService.checkActive(user.email);
      if (!isActive) {
        logger.warn(
          { action: 'login_failed', email: emailForLog, reason: 'account_not_verified' },
          'Login failed',
        );
        throw new ServiceError({
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          statusCode: 401,
          message: 'Account not verified. Please verify your email.',
        });
      }
      const result = await this.issueTokens(user, response, dataDevice, deviceId);
      logger.info({ action: 'login_success', userId: user.id, email: user.email }, 'Login success');
      return result as loginResponseDto;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.warn(
        { action: 'login_failed', email: emailForLog, reason: (error as Error)?.message },
        'Login failed',
      );
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
        message: error.message ?? 'Invalid email or password',
      });
    }
  }
  async refresh(
    refreshTokenOld: string,
    deviceId: string,
    response: any,
    req: any,
  ): Promise<loginResponseDto> {
    try {
      const decoded = this.jwtService.verify(refreshTokenOld, {
        secret: process.env.JWT_SECRET,
        issuer: process.env.JWT_ISSUER || 'auth-service',
        audience: process.env.JWT_AUDIENCE || 'api',
      });
      const dataDevice = await this.getDeviceData(req);
      const user = await this.usersService.findByRefreshToken(
        decoded.sub,
        decoded.permVersion,
        refreshTokenOld,
        deviceId,
      );
      return await this.issueTokens(user, response, dataDevice, deviceId, refreshTokenOld);
    } catch (error) {
      response.clearCookie('refreshToken');
      response.clearCookie('deviceId');
      throw new ServiceError({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        statusCode: 401,
        message: error.message ?? 'Invalid refresh token',
      });
    }
  }
  async info(user: UserInterface): Promise<InfoUserDto> {
    return (await this.usersService.info(user)) as InfoUserDto;
  }
  async resendCode(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findOneByEmail(email);

      if (!user || user.isActive) {
        throw new ServiceError({
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          statusCode: 401,
          message: 'Not found user',
        });
      }
      const codeHash = await hashPassword(Math.random().toString(36).substring(2, 15));
      const code = encrypt(codeHash, getEncryptKey());
      await this.usersService.createOrUpdateEmailOtp(user.id, codeHash);
      const eventPayload = {
        userId: user.id,
        email: user.email,
        code: code,
        createdAt: user.createdAt.toISOString(),
      };

      const validatedPayload = UserRegisteredSchema.parse(eventPayload);

      await this.natsService.publish(USER_REGISTERED, validatedPayload);

      logger.info(
        {
          action: 'user.registered',
          userId: user.id,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        },
        'User registered successfully',
      );
      return { message: 'Verification code resent' };
    } catch (error) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
        message: error.message ?? 'Not found user',
      });
    }
  }
  async logoutDevice(
    deviceId: string,
    response: any,
    user: UserInterface,
    refreshToken: string,
  ): Promise<string> {
    await this.usersService.logoutDevice(deviceId, user.id, refreshToken);
    response.clearCookie('refreshToken');
    response.clearCookie('deviceId');
    return 'logout success';
  }
  async logoutAll(response: any, user: any): Promise<string> {
    await this.usersService.logoutAllDevices(user.id);
    response.clearCookie('refreshToken');
    response.clearCookie('deviceId');
    return 'logout success';
  }

  async forgotPassword(forgotPasswordDto: { email: string }): Promise<{ message: string }> {
    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    try {
      const user = await this.usersService.findOneByEmail(forgotPasswordDto.email);
      if (!user) {
        return { message: genericMessage };
      }

      const payload = await this.usersService.createPasswordReset(user.id);
      const eventPayload = {
        userId: user.id,
        email: user.email,
        token: payload.token,
        expiresAt: payload.expiresAt.toISOString(),
      };
      const validatedPayload = PasswordResetRequestedSchema.parse(eventPayload);
      await this.queueService.sendResetPassword(validatedPayload);
      logger.info(
        {
          action: PASSWORD_RESET_REQUESTED,
          userId: user.id,
          email: user.email,
          token: payload.token,
          expiresAt: payload.expiresAt.toISOString(),
        },
        'Password reset email sent',
      );
      return { message: genericMessage };
    } catch (error) {
      logger.error(
        {
          error: error.message,
          email: forgotPasswordDto.email,
        },
        'Forgot password: failed to create or send reset',
      );
      return { message: genericMessage };
    }
  }
  async forgotPasswordVerify(forgotPasswordVerifyDto: {
    email: string;
    code: string;
  }): Promise<any> {
    try {
      const user = await this.usersService.findOneByEmail(forgotPasswordVerifyDto.email);
      if (!user) {
        throw new ServiceError({
          code: ErrorCodes.NOT_FOUND,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Email not found',
        });
      }
      await this.usersService.verifyPasswordReset(user.id, forgotPasswordVerifyDto.code);
      logger.info(
        {
          action: 'password_reset_verified',
          userId: user.id,
          email: user.email,
          code: forgotPasswordVerifyDto.code,
        },
        'Password reset verified',
      );
      return { message: 'Password reset verified' };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message ?? 'Error verifying password reset',
      });
    }
  }
  async forgotPasswordReset(forgotPasswordResetDto: {
    email: string;
    code: string;
    password: string;
  }): Promise<any> {
    try {
      const user = await this.usersService.findOneByEmail(forgotPasswordResetDto.email);
      if (!user) {
        throw new ServiceError({
          code: ErrorCodes.NOT_FOUND,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Email not found',
        });
      }
      await this.usersService.resetPassword(
        user.id,
        forgotPasswordResetDto.password,
        forgotPasswordResetDto.code,
      );
      await this.usersService.logoutAllDevices(user.id);
      logger.info(
        {
          action: 'password_reset_success',
          userId: user.id,
          email: user.email,
          code: forgotPasswordResetDto.code,
        },
        'Password reset success',
      );
      return { message: 'Password reset success' };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message ?? 'Error resetting password',
      });
    }
  }
}
