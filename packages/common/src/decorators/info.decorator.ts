import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Lấy req.info (thường do InternalJwtAuthGuard gán: { caller, data }).
 * @Info() → toàn bộ req.info
 * @Info('data') → req.info.data (ví dụ userId)
 * @Info('caller') → req.info.caller (ví dụ 'gateway')
 */
export const Info = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return data ? request.info?.[data] : request.info;
});
