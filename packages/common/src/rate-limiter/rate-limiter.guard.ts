import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { logger } from '../logging/logger';
import { ErrorCodes } from '../errors/error-codes';
import { ServiceError } from '../errors/service-error';
import { RATE_LIMIT_KEY } from './rate-limiter.constants';
import { RateLimiterService } from './rate-limiter.service';
import type { RateLimitRule, RateLimitResult } from './rate-limiter.interfaces';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rules || rules.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    let mostRestrictive: { rule: RateLimitRule; result: RateLimitResult } | null = null;

    for (const rule of rules) {
      const key = this.buildKey(req, rule);
      const result = await this.rateLimiterService.check(key, rule.limit, rule.window);

      if (!mostRestrictive || result.remaining < mostRestrictive.result.remaining) {
        mostRestrictive = { rule, result };
      }

      if (!result.allowed) {
        const requestId = req.requestId ?? req.headers?.['x-request-id'];
        logger.warn(
          { requestId, key, limit: rule.limit, window: rule.window },
          'Rate limit exceeded',
        );

        this.setHeaders(res, rule.limit, 0, result.retryAfterMs);

        throw new ServiceError({
          code: ErrorCodes.TOO_MANY_REQUESTS,
          statusCode: 429,
          message: rule.message || 'Too many requests, please try again later',
        });
      }
    }

    if (mostRestrictive) {
      this.setHeaders(
        res,
        mostRestrictive.rule.limit,
        mostRestrictive.result.remaining,
        mostRestrictive.result.retryAfterMs,
      );
    }

    return true;
  }

  private buildKey(req: any, rule: RateLimitRule): string {
    const { prefix, keySource } = rule;
    let identifier: string;

    switch (keySource) {
      case 'ip':
        identifier = this.extractIp(req);
        break;
      case 'userId':
        identifier = req.user?.userId || req.user?.sub || 'anonymous';
        break;
      default:
        if (keySource.startsWith('body.')) {
          const field = keySource.slice(5);
          const value = req.body?.[field];
          identifier = value
            ? createHash('sha256')
                .update(String(value).toLowerCase().trim())
                .digest('hex')
                .slice(0, 16)
            : 'empty';
        } else {
          identifier = 'unknown';
        }
    }

    return `${prefix}:${identifier}`;
  }

  private extractIp(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0]?.trim() || 'unknown';
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  private setHeaders(res: any, limit: number, remaining: number, retryAfterMs: number): void {
    try {
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        if (retryAfterMs > 0) {
          res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
        }
      }
    } catch {
      // Headers may already be sent
    }
  }
}
