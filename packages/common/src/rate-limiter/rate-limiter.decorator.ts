import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from './rate-limiter.constants';
import type { RateLimitRule } from './rate-limiter.interfaces';

/**
 * Apply rate limiting to a route or controller.
 *
 * @example Single rule
 * ```ts
 * @RateLimit({ prefix: 'register', limit: 5, window: 60, keySource: 'ip' })
 * ```
 *
 * @example Multiple rules (all must pass)
 * ```ts
 * @RateLimit([
 *   { prefix: 'login:ip', limit: 10, window: 60, keySource: 'ip' },
 *   { prefix: 'login:email', limit: 5, window: 60, keySource: 'body.email' },
 * ])
 * ```
 */
export const RateLimit = (rules: RateLimitRule | RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, Array.isArray(rules) ? rules : [rules]);
