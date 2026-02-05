import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hashPassword, verifyPassword } from '@common/core';
import { CreateUserResponseDto } from './dto/resCreateUser.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user with hashed password
   */
  async create(dto: CreateUserDto): Promise<CreateUserResponseDto> {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(dto.password);
    const codeHash = await hashPassword(Math.random().toString(36).substring(2, 15));
    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        isActive: false,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    const emailOtp = await this.prisma.emailOtp.create({
      data: {
        userId: user.id,
        codeHash: codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    // Return user without password hash
    return {
      userId: user.id,
      email: user.email,
      code: emailOtp.codeHash,
      createdAt: user.createdAt,
    } as CreateUserResponseDto;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Validate user password
   */
  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) return false;

    return verifyPassword(user.passwordHash, password);
  }
}
