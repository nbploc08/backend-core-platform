import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ErrorCodes, logger, ServiceError } from '@common/core';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({ usernameField: 'email' });
  }
  async validate(email: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      logger.warn(
        { action: 'login_failed', email: email?.toLowerCase?.()?.trim?.(), reason: 'invalid_credentials' },
        'Login failed',
      );
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }
    return user;
  }
}
