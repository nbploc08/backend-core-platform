import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Register a new user
   * - Validates input via DTO
   * - Creates user with hashed password
   * - Returns user data without passwordHash
   */
  async register(dto: RegisterDto) {
    return this.usersService.create(dto);
  }
}
