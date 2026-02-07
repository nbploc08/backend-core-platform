import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ServiceError } from '@common/core';
import { ErrorCodes } from '@common/core';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({ usernameField: 'email' });
  }
  async validate(email: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }
    return user;
  }
}
