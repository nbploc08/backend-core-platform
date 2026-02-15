import { Injectable } from '@nestjs/common';
import { UserRegisteredEventDto } from './dto/userRegisteredEvent.dto';
import { MailsService } from '../mails/mails.service';
import { decrypt, getEncryptKey, logger, ServiceError, ErrorCodes } from '@common/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailsService: MailsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(userRegisteredEvent: UserRegisteredEventDto): Promise<boolean> {
    const code = decrypt(userRegisteredEvent.code, getEncryptKey());
    await this.mailsService.sendVerifyCode(userRegisteredEvent.email, code);
    logger.info(`Send verify code to ${userRegisteredEvent.email}`);
    return true;
  }

  async listByUser(
    userId: string,
    pageRaw?: string,
    limitRaw?: string,
    sortByRaw?: string,
    sortOrderRaw?: string,
  ) {
    if (!userId) {
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: 'userId is required',
      });
    }

    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw ?? 20) || 20));
    const skip = (page - 1) * limit;
    const allowedSortFields = ['createdAt', 'readAt'] as const;
    const sortBy = allowedSortFields.includes(sortByRaw as (typeof allowedSortFields)[number])
      ? (sortByRaw as (typeof allowedSortFields)[number])
      : 'createdAt';
    const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      sortBy,
      sortOrder,
    };
  }

  async unreadCount(userId: string) {
    if (!userId) {
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: 'userId is required',
      });
    }

    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    if (!userId || !notificationId) {
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: 'userId and notificationId are required',
      });
    }

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new ServiceError({
        code: ErrorCodes.NOTI_NOT_FOUND,
        statusCode: 404,
        message: 'Notification not found',
      });
    }

    if (existing.readAt) {
      return { id: existing.id, readAt: existing.readAt.toISOString() };
    }

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });

    return { id: updated.id, readAt: updated.readAt?.toISOString() ?? null };
  }

  async readAll(userId: string) {
    if (!userId) {
      throw new ServiceError({
        code: ErrorCodes.VALIDATION_ERROR,
        statusCode: 400,
        message: 'userId is required',
      });
    }

    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }
}
