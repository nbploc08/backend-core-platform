import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PermissionCache {
  private redis: Redis;
  private readonly CACHE_TTL = 5 * 60; // 5 minutes in seconds

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
  }

  private cacheKey(userId: string, permVersion: number): string {
    return `permissions:${userId}:${permVersion}`;
  }

  async set(userId: string, permVersion: number, permissions: string[]) {
    const key = this.cacheKey(userId, permVersion);
    const data = {
      permissions,
      permVersion,
      cachedAt: Date.now(),
    };

    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(data));
  }

  async get(userId: string, currentPermVersion: number): Promise<string[]> {
    const key = this.cacheKey(userId, currentPermVersion);
    const cached = await this.redis.get(key);
    console.log('PermissionCache.get', { key, cached });
    if (!cached) {
      return [];
    }

    const data = JSON.parse(cached);
    return data.permissions;
  }

  async invalidate(userId: string) {
    // Delete all permission versions for user
    const pattern = `permissions:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async clear() {
    await this.redis.flushall();
  }
}
