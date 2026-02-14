import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AllowedTokenType, TOKEN_TYPE_KEY } from '../decorators/token-type.decorator';

@Injectable()
export class TokenTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredType = this.reflector.getAllAndOverride<AllowedTokenType | undefined>(
      TOKEN_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actualType = request?.user?.type as AllowedTokenType | undefined;

    if (!actualType || actualType !== requiredType) {
      throw new ForbiddenException('Invalid token type for this endpoint');
    }

    return true;
  }
}
