// packages/common/src/permission/permission.provider.ts
import { Injectable, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { AxiosInstance, AxiosError } from 'axios';
import { PermissionCache } from './permission.cache';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PermissionProvider {
  private readonly logger = new Logger(PermissionProvider.name);

  constructor(
    private cache: PermissionCache,
    @Inject('HTTP_CLIENT') private httpClient: AxiosInstance, // ← FIX: Add @Inject decorator
    private configService: ConfigService, // ← FIX: Add ConfigService
  ) {}

  private signInternalToken(payload?: object): string {
    const secret = this.configService.get<string>('INTERNAL_JWT_SECRET') || 'change-internal';
    const issuer = this.configService.get<string>('INTERNAL_JWT_ISSUER') || 'gateway';
    const audience = this.configService.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal';

    return jwt.sign(
      {
        sub: 'service',
        data: payload ?? {},
      },
      secret,
      {
        issuer,
        audience,
        expiresIn: '5m',
      },
    );
  }

  private internalHeaders(requestId?: string, payload?: object) {
    const token = this.signInternalToken(payload);
    return {
      Authorization: `Bearer ${token}`,
      'x-request-id': requestId || 'internal-call',
    };
  }

  async getPermissions(
    userId: string,
    permVersion: number,
    requestId: string,
    authServiceUrl?: string,
  ): Promise<string[]> {
    // 1. Check cache first
    const cached = await this.cache.get(userId, permVersion);
    if (cached?.length > 0) {
      this.logger.debug(`Cache hit for user ${userId}, permVersion ${permVersion}`);
      return cached;
    }

    // 2. Call Auth Service to get permissions
    try {
      const baseUrl =
        authServiceUrl ||
        this.configService.get<string>('AUTH_SERVICE_URL') ||
        'http://localhost:3001';

      this.logger.debug(`Fetching permissions for user ${userId} from ${baseUrl}`);

      const response = await this.httpClient.get(`${baseUrl}/roles/users/${userId}/permissions`, {
        headers: this.internalHeaders(requestId, { userId }),
        timeout: 5000, // 5 second timeout
      });

      // Validate HTTP status
      if (response.status !== 200) {
        this.logger.error(
          `Auth Service returned status ${response.status}: ${response.statusText}`,
        );
        throw new HttpException(
          `Auth Service error: ${response.status} ${response.statusText}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Validate response data
      if (!response.data || !Array.isArray(response.data)) {
        this.logger.error(
          `Invalid response format from Auth Service: ${JSON.stringify(response.data)}`,
        );
        throw new HttpException(
          'Invalid response format from Auth Service',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const permissions: string[] = response.data;

      this.logger.debug(
        `Retrieved ${permissions.length} permissions for user ${userId}: [${permissions.join(', ')}]`,
      );

      // 3. Cache the result
      this.cache.set(userId, permVersion, permissions);

      return permissions;
    } catch (error) {
      // Enhanced error handling
      if (error instanceof HttpException) {
        throw error; // Re-throw our custom errors
      }

      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNREFUSED') {
        this.logger.error(`Cannot connect to Auth Service: ${axiosError.message}`);
        throw new HttpException('Auth Service is unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }

      if (axiosError.response) {
        this.logger.error(
          `Auth Service error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`,
        );
        throw new HttpException(
          `Auth Service returned error: ${axiosError.response.status}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (axiosError.request) {
        this.logger.error(`Network error when calling Auth Service: ${axiosError.message}`);
        throw new HttpException(
          'Network error when fetching permissions',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.error(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException('Failed to fetch permissions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  hasPermission(userPermissions: string[], requiredPermissions: string | string[]): boolean {
    const required = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    // Log permission check for debugging
    const hasAnyPermission = required.some((perm) => userPermissions.includes(perm));

    this.logger.debug(
      `Permission check: required=[${required.join(', ')}], user=[${userPermissions.join(', ')}], result=${hasAnyPermission}`,
    );

    return hasAnyPermission;
  }

  invalidateUserCache(userId: string) {
    this.logger.debug(`Invalidating cache for user ${userId}`);
    this.cache.invalidate(userId);
  }
}
