import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PermissionCache {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
  }

  private cacheKey(userId: string): string {
    return `permissions:user:${userId}:`;
  }

  async set(userId: string, permVersion: number, permissions: string[]) {
    const key = this.cacheKey(userId);

    await this.redis.hset(key, {
      permVersion: permVersion.toString(),
      permissions: JSON.stringify(permissions),
    });
  }

  async get(userId: string, permVersion: number): Promise<string[]> {
    const key = this.cacheKey(userId);
    const cached = await this.redis.hgetall(key);

    if (
      !cached ||
      Object.keys(cached).length === 0 ||
      cached.permVersion !== permVersion.toString()
    ) {
      return [];
    }

    const data = JSON.parse(cached.permissions);
    return data;
  }

  async invalidate(userId: string) {
    await this.redis.del(this.cacheKey(userId));
  }
  async updatePermVersion(userId: string, permVersion: number) {
    const key = this.cacheKey(userId);
    const exists = await this.redis.exists(key);
    if (exists) {
      await this.set(userId, permVersion, []);
    }
  }
  async clear() {
    await this.redis.flushall();
  }
}
