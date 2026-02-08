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
import { UserAuthResponseDto } from './dto/userAuth.dto';
import { UserInterface } from 'src/entities/user.entities';
import { InfoUserDto } from './dto/infoUser.dto';

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
  async createOrUpdateEmailOtp(userId: string, codeHash: string): Promise<any> {
    return await this.prisma.emailOtp.upsert({
      where: { userId: userId },
      update: { codeHash: codeHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      create: {
        userId: userId,
        codeHash: codeHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
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

    await this.createOrUpdateEmailOtp(user.id, codeHash);

    return {
      userId: user.id,
      email: user.email,
      code: code,
      createdAt: user.createdAt,
    } as CreateUserResponseDto;
  }

  async veryfiRegister(email: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: false },
    });
    if (!user) {
      throw new NotFoundException('User not found Or already verified');
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
  async findByRefreshToken(
    id: string,
    permVersion: number,
    refreshToken: string,
    deviceId: any,
  ): Promise<UserAuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
        permVersion: permVersion,
        refreshTokens: {
          some: {
            tokenHash: refreshToken,
            deviceId: deviceId,
            expiresAt: {
              gt: new Date(),
            },
            revokedAt: null,
          },
        },
      },
      select: {
        id: true,
        email: true,
        permVersion: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        statusCode: 401,
        message: 'Invalid refresh token',
      });
    }
    return {
      id: user.id,
      email: user.email,
      permVersion: user.permVersion,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as UserAuthResponseDto;
  }
  async info(user: UserInterface): Promise<InfoUserDto> {
    return (await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    })) as InfoUserDto;
  }
  async logoutDevice(deviceId: string, userId: string, refreshToken: string) {
    return await this.prisma.refreshToken.updateMany({
      where: {
        deviceId: deviceId,
        userId: userId,
        tokenHash: refreshToken,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAllDevices(userId: string) {
    return await this.prisma.refreshToken.updateMany({
      where: {
        revokedAt: null,
        userId: userId,
      },
      data: { revokedAt: new Date() },
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
