import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NatsService } from '../nats/nats.service';
import { RegisterDto } from './dto/register.dto';
import { logger } from '@common/core';
import { USER_REGISTERED, UserRegisteredSchema } from '@contracts/core';
import { RegisterResponseDto } from './dto/registerRes.dto';
import { VerifyRegisterDto } from './dto/verifyRegister.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly natsService: NatsService,
  ) {}

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
}
