import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { logger } from './logger';

@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const ctx = context.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const requestId = req.requestId;

        logger.info(
          {
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: ms,
          },
          'http_request',
        );
      }),
    );
  }
}
