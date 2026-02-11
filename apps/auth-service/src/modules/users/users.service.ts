import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  encrypt,
  ErrorCodes,
  getEncryptKey,
  hashPassword,
  logger,
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
  async createPasswordReset(userId: string): Promise<any> {
    const token = Math.random().toString(36).substring(2, 15);
    const tokenHash = await hashPassword(token);
    const tokenHashEncrypted = encrypt(tokenHash, getEncryptKey());
    await this.prisma.passwordReset.create({
      data: {
        userId: userId,
        tokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return {
      token: tokenHashEncrypted,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit passwordHash from result
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }
  async checkActiveEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
    });
    if (!user) {
      logger.warn(
        { action: 'login_failed', email: email, reason: 'account_not_verified or not_found' },
        'Login failed',
      );
      throw new ServiceError({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
        message: 'account_not_verified or not_found.',
      });
    }
    return user;
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
    const tokenHashNew = await hashPassword(refreshTokenNew);

    const existing = await this.prisma.refreshToken.findFirst({
      where: { userId: id, deviceId, revokedAt: null },
    });

    if (existing) {
      if (refreshTokenOld) {
        const valid = await verifyPassword(existing.tokenHash, refreshTokenOld);
        if (!valid) {
          throw new ServiceError({
            code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
            statusCode: 401,
            message: 'Invalid refresh token',
          });
        }
      }
      return await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { tokenHash: tokenHashNew, expiresAt },
      });
    }

    return await this.prisma.refreshToken.create({
      data: {
        userId: id,
        tokenHash: tokenHashNew,
        deviceId,
        deviceName: dataDevice.deviceName,
        ipAddress: dataDevice.ip,
        userAgent: dataDevice.userAgent,
        expiresAt,
      },
    });
  }
  async findByRefreshToken(
    id: string,
    _permVersion: number,
    refreshToken: string,
    deviceId: string,
  ): Promise<UserAuthResponseDto> {
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        userId: id,
        deviceId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: { user: true },
    });
    if (!session) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        statusCode: 401,
        message: 'Invalid refresh token',
      });
    }
    const valid = await verifyPassword(session.tokenHash, refreshToken);
    if (!valid) {
      throw new ServiceError({
        code: ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        statusCode: 401,
        message: 'Invalid refresh token',
      });
    }
    const u = session.user;
    return {
      id: u.id,
      email: u.email,
      permVersion: u.permVersion,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
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
    const session = await this.prisma.refreshToken.findFirst({
      where: { userId, deviceId, revokedAt: null },
    });
    if (!session) return { count: 0 };
    const valid = await verifyPassword(session.tokenHash, refreshToken);
    if (!valid) return { count: 0 };
    return await this.prisma.refreshToken.updateMany({
      where: { id: session.id },
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
   * Get profile by userId (for internal endpoint)
   */
  async getProfileById(userId: string): Promise<InfoUserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });
    return user as InfoUserDto | null;
  }

  /**
   * Validate user password
   */
  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = await this.findOneByEmail(email);
    if (!user) return false;

    return verifyPassword(user.passwordHash, password);
  }
  async verifyPasswordReset(userId: string, code: string) {
    const passwordReset = await this.prisma.passwordReset.findFirst({
      where: { userId, expiresAt: { gt: new Date() }, used: false },
    });
    if (!passwordReset) {
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'expired or already used',
      });
    }

    const verify = await verifyPassword(passwordReset.tokenHash, code);
    if (!verify) {
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid code',
      });
    }
    await this.prisma.passwordReset.update({
      where: { id: passwordReset.id },
      data: { used: true },
    });
    return true;
  }
  async resetPassword(userId: string, password: string, code: string) {
    const passwordReset = await this.prisma.passwordReset.findFirst({
      where: { userId, used: true },
    });
    if (!passwordReset) {
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'The code has not been verified',
      });
    }
    const verify = await verifyPassword(passwordReset.tokenHash, code);
    if (!verify) {
      throw new ServiceError({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid code',
      });
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.passwordReset.delete({
      where: { id: passwordReset.id },
    });
    return true;
  }
}
