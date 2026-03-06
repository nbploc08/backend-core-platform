import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { logger } from '../logging/logger';
import { RATE_LIMIT_LUA_SCRIPT, RATE_LIMITER_OPTIONS } from './rate-limiter.constants';
import type { RateLimitResult, RateLimiterModuleOptions } from './rate-limiter.interfaces';

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private redis: Redis;
  private readonly keyPrefix: string;
  private readonly disabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(RATE_LIMITER_OPTIONS) options?: RateLimiterModuleOptions,
  ) {
    const redisUrl =
      options?.redisUrl || this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.keyPrefix = options?.keyPrefix ?? 'rl';
    this.disabled = options?.disabled ?? false;

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    this.redis.on('error', (err) => {
      logger.error({ err: err.message }, 'RateLimiter Redis connection error');
    });

    this.redis.connect().catch((err) => {
      logger.error({ err: err.message }, 'RateLimiter failed to connect to Redis');
    });
  }

  /**
   * Check if a request is allowed under the given rate limit.
   * Uses atomic Lua script for thread-safe increment + check.
   */
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (this.disabled) {
      return { allowed: true, count: 0, remaining: limit, retryAfterMs: 0 };
    }

    const fullKey = `${this.keyPrefix}:${key}`;
    const windowMs = windowSeconds * 1000;

    try {
      const results = (await this.redis.eval(
        RATE_LIMIT_LUA_SCRIPT,
        1,
        fullKey,
        limit.toString(),
        windowMs.toString(),
      )) as [number, number, number];

      const [allowed, count, ttlMs] = results;
      return {
        allowed: allowed === 1,
        count,
        remaining: Math.max(0, limit - count),
        retryAfterMs: allowed === 1 ? 0 : Math.max(0, ttlMs),
      };
    } catch (err) {
      // If Redis is down, allow the request (fail-open) and log the error
      logger.error(
        { err: err instanceof Error ? err.message : err, key: fullKey },
        'RateLimiter Redis error — failing open',
      );
      return { allowed: true, count: 0, remaining: limit, retryAfterMs: 0 };
    }
  }

  /**
   * Manually reset a rate limit key (useful for testing or admin actions).
   */
  async reset(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}:${key}`;
    await this.redis.del(fullKey);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }
}
