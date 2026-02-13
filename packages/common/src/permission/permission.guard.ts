import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PermissionProvider } from './permission.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionProvider: PermissionProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequirePermission() decorator, allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 3. Get user from request
    const request = context.switchToHttp().getRequest();

    // 4. Check token type - Skip permission check for Internal JWT (trusted service-to-service)
    const tokenType = request.user?.type;
    if (tokenType === 'internal') {
      // Internal JWT từ gateway/services → trusted, skip permission check
      return true;
    }

    // 5. For User JWT, check permissions
    const userId = request.user?.userId || request.user?.data?.id;
    const permVersion = request.user?.permVersion || request.user?.data?.permVersion;
    const requestId = request.headers['x-request-id'];

    if (!userId || permVersion === undefined) {
      throw new ForbiddenException('Missing user context for permission check');
    }

    // 6. Fetch user permissions (with cache)
    const userPermissions = await this.permissionProvider.getPermissions(
      userId,
      typeof permVersion === 'string' ? parseInt(permVersion) : permVersion,
      requestId,
    );

    // 7. Check if user has required permissions
    const hasPermission = this.permissionProvider.hasPermission(
      userPermissions,
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    // 8. Attach permissions to request for logging/audit
    request.userPermissions = userPermissions;

    return true;
  }
}
