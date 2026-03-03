export type RateLimitKeySource = 'ip' | 'userId' | `body.${string}`;

export interface RateLimitRule {
  /** Prefix for the Redis key (e.g., 'login', 'forgot-password') */
  prefix: string;
  /** Maximum number of requests within the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Source for the rate limit key extraction from request */
  keySource: RateLimitKeySource;
  /** Custom error message (optional) */
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiterModuleOptions {
  /** Redis URL (falls back to ConfigService REDIS_URL if not set) */
  redisUrl?: string;
  /** Global prefix for all rate limit keys (default: 'rl') */
  keyPrefix?: string;
  /** Disable rate limiting entirely (useful for testing) */
  disabled?: boolean;
}
