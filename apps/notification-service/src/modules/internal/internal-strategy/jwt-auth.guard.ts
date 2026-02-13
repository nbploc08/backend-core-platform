import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class InternalJwtAuthGuard extends AuthGuard('internal-jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
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
