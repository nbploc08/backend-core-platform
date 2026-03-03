import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RATE_LIMITER_OPTIONS } from './rate-limiter.constants';
import { RateLimiterGuard } from './rate-limiter.guard';
import { RateLimiterService } from './rate-limiter.service';
import type { RateLimiterModuleOptions } from './rate-limiter.interfaces';

/**
 * Rate limiter module using Redis for distributed rate limiting.
 *
 * @example Basic usage (reads REDIS_URL from ConfigService)
 * ```ts
 * RateLimiterModule.register()
 * ```
 *
 * @example With custom options
 * ```ts
 * RateLimiterModule.register({
 *   keyPrefix: 'myapp',
 *   disabled: process.env.NODE_ENV === 'test',
 * })
 * ```
 */
@Global()
@Module({})
export class RateLimiterModule {
  static register(options?: RateLimiterModuleOptions): DynamicModule {
    return {
      module: RateLimiterModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        Reflector,
        {
          provide: RATE_LIMITER_OPTIONS,
          useValue: options ?? {},
        },
        RateLimiterService,
        RateLimiterGuard,
      ],
      exports: [RateLimiterService, RateLimiterGuard],
    };
  }
}
