import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NatsService } from '../nats/nats.service';
import { RegisterDto } from './dto/register.dto';
import { ErrorCodes, logger, ServiceError } from '@common/core';
import { USER_REGISTERED, UserRegisteredSchema } from '@contracts/core';
import { RegisterResponseDto } from './dto/registerRes.dto';
import { VerifyRegisterDto } from './dto/verifyRegister.dto';
import { loginResponseDto } from './dto/loginRes.dto';
import { UAParser } from 'ua-parser-js';
import { randomUUID } from 'crypto';
import { UserInterface } from '../../entities/user.entities';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly natsService: NatsService,
    private readonly jwtService: JwtService,
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
    const payload = { email: user.email, sub: user.id };

    //
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

    await this.natsService.publish(USER_REGISTERED, validatedPayload);

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
    } catch (error) {
      logger.error({ dto }, 'Failed to verify user');
      throw new BadRequestException('Failed to verify user');
    }
  }

  async login(user: any, response: any, req: any): Promise<loginResponseDto> {
    try {
      const dataDevice = await this.getDeviceData(req);
      const deviceId = randomUUID();
      const isActive = await this.usersService.checkActive(user.email);
      if (!isActive) {
        throw new ServiceError({
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          statusCode: 401,
          message: 'Account not verified. Please verify your email.',
        });
      }
      const result = await this.issueTokens(user, response, dataDevice, deviceId);
      return result as loginResponseDto;
    } catch (error) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,

        message: error.message ?? 'Invalid email or password',
      });
    }
  }
}
