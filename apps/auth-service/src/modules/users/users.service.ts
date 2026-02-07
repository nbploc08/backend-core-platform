import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  encrypt,
  ErrorCodes,
  getEncryptKey,
  hashPassword,
  ServiceError,
  verifyPassword,
} from '@common/core';
import { CreateUserResponseDto } from './dto/resCreateUser.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async findOneByEmail(email: string) {
    return await this.prisma.user.findFirst({
      where: { email },
    });
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = email?.toLowerCase().trim();
    const user = await this.findOneByEmail(normalizedEmail);
    const validPassword = user ? await verifyPassword(user.passwordHash, pass) : false;
    if (user && validPassword) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }
  async checkActive(email: string) {
    const result = await this.prisma.user.findFirst({
      where: { email },
      select: { isActive: true },
    });
    return result?.isActive ?? false;
  }
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
    const code = encrypt(codeHash, getEncryptKey());

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
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return {
      userId: user.id,
      email: user.email,
      code: code,
      createdAt: user.createdAt,
    } as CreateUserResponseDto;
  }

  async veryfiRegister(email: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isActive) {
      throw new BadRequestException('User already verified');
    }
    const verifyOtp = await this.prisma.emailOtp.findFirst({
      where: { userId: user.id, codeHash: code, expiresAt: { gt: new Date() } },
    });
    if (!verifyOtp) {
      throw new BadRequestException('Invalid code');
    }
    await this.prisma.emailOtp.update({
      where: { id: verifyOtp.id },
      data: { isUsed: true },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
    });
    return true;
  }
  async saveRefreshToken(
    id: string,
    refreshTokenNew: string,
    dataDevice: any,
    deviceId: string,
    refreshTokenOld?: string,
  ) {
    const ttlSeconds = Number(process.env.JWT_REFRESH_EXPIRES_IN);
    const refreshTtlSeconds =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 60 * 60 * 24 * 30; // default 30 days

    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

    return await this.prisma.refreshToken.upsert({
      where: {
        userId: id,
        tokenHash: refreshTokenOld ?? '',
        deviceId: deviceId,
      },
      update: { tokenHash: refreshTokenNew },
      create: {
        userId: id,
        tokenHash: refreshTokenNew,
        deviceId: deviceId,
        deviceName: dataDevice.deviceName,
        ipAddress: dataDevice.ip,
        userAgent: dataDevice.userAgent,
        expiresAt,
      },
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
    const user = await this.findOneByEmail(email);
    if (!user) return false;

    return verifyPassword(user.passwordHash, password);
  }
}
