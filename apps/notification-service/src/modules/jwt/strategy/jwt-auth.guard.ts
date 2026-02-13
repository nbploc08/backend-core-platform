import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from '@common/core';
import { JwtValidationResult } from './jwt.strategy';

/**
 * Combined JWT Auth Guard
 *
 * Guard này sử dụng CombinedJwtStrategy để verify cả 2 loại token:
 * 1. Internal JWT (từ gateway/services)
 * 2. User JWT (forward từ gateway)
 *
 * Sau khi verify thành công:
 * - req.user chứa kết quả từ validate() với type: 'internal' | 'user'
 * - req.info chứa thông tin cho internal calls (backward compatible)
 */
@Injectable()
export class CombinedJwtAuthGuard extends AuthGuard('combined-jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Verify JWT
    const result = super.canActivate(context);
    const ok =
      result instanceof Observable ? await lastValueFrom(result) : await Promise.resolve(result);

    if (ok) {
      const req = context.switchToHttp().getRequest();
      const user = req.user as JwtValidationResult;

      // req.user đã có type: 'internal' | 'user' từ CombinedJwtStrategy.validate()
      // PermissionGuard sẽ đọc req.user.type để quyết định skip hay check permission

      if (user.type === 'internal') {
        // Set req.info for backward compatibility with internal calls
        req.info = {
          caller: user.caller,
          data: user.data,
        };
      }

      // For user JWT, req.user already contains: { type: 'user', userId, email, permVersion }
      // No additional processing needed
    }

    return ok;
  }
}

/**
 * Internal JWT Auth Guard (backward compatible)
 *
 * Guard này chỉ accept Internal JWT (từ gateway/services)
 * Dùng cho các endpoints chỉ cho phép service-to-service calls
 */
@Injectable()
export class InternalJwtAuthGuard extends AuthGuard('internal-jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Verify Internal JWT
    const result = super.canActivate(context);
    const ok =
      result instanceof Observable ? await lastValueFrom(result) : await Promise.resolve(result);

    if (ok) {
      const req = context.switchToHttp().getRequest();
      req.info = req.user;
    }

    return ok;
  }
}

/**
 * User JWT Auth Guard
 *
 * Guard này chỉ accept User JWT (forward từ gateway)
 * Dùng cho các endpoints cần xác thực user trực tiếp
 *
 * Lưu ý: Cần tạo UserJwtStrategy riêng nếu muốn dùng guard này
 */
@Injectable()
export class UserJwtAuthGuard extends AuthGuard('user-jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Verify User JWT
    const result = super.canActivate(context);
    const ok =
      result instanceof Observable ? await lastValueFrom(result) : await Promise.resolve(result);

    return ok;
  }
}
