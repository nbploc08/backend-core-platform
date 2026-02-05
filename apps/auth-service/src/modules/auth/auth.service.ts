import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NatsService } from '../nats/nats.service';
import { RegisterDto } from './dto/register.dto';
import { logger } from '@common/core';
import { USER_REGISTERED, UserRegisteredSchema } from '@contracts/core';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Register a new user
   * - Validates input via DTO
   * - Creates user with hashed password
   * - Publishes USER_REGISTERED event
   * - Audit logs the action
   * - Returns user data without passwordHash
   */
  async register(dto: RegisterDto) {
    // 1. Create user in database
    const user = await this.usersService.create(dto);

    // 2. Publish USER_REGISTERED event to NATS JetStream
    const eventPayload = {
      userId: user.userId,
      email: user.email,
      code: user.code,
      createdAt: user.createdAt.toISOString(),
    };

    // Validate payload against contract
    const validatedPayload = UserRegisteredSchema.parse(eventPayload);

    await this.natsService.publish(USER_REGISTERED, validatedPayload);

    // 3. Audit log
    logger.info(
      {
        action: 'user.registered',
        userId: user.userId,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      'User registered successfully',
    );

    return user;
  }
}
