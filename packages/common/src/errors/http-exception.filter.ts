import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logger } from '../logging/logger';
import { ErrorCode } from './error-codes';
import { ServiceError } from './service-error';

type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  traceId?: string;
};

function safeString(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();

    const traceId: string | undefined = req?.requestId;
    const method = req?.method;
    const path = req?.originalUrl || req?.url;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      error: { code: ErrorCode.INTERNAL, message: 'Internal server error' },
      traceId,
    };

    // 1) Business error (chuẩn core)
    if (exception instanceof ServiceError) {
      statusCode = exception.statusCode;

      body = {
        error: {
          code: exception.code,
          message: exception.exposeMessage ? exception.message : 'Request failed',
          details: exception.details,
        },
        traceId,
      };

      // log warn/error tuỳ status
      const logFn = statusCode >= 500 ? logger.error : logger.warn;
      logFn(
        { traceId, method, path, statusCode, code: exception.code, details: exception.details },
        exception.message,
      );

      return res.status(statusCode).json(body);
    }

    // 2) Validation error (thường do class-validator / pipes)
    if (exception instanceof BadRequestException) {
      statusCode = exception.getStatus();
      const resp: any = exception.getResponse();

      // resp.message thường là array các lỗi validation
      const details = resp?.message;

      body = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details,
        },
        traceId,
      };
      logger.warn({ traceId, method, path, statusCode, details }, 'validation_failed');
      return res.status(statusCode).json(body);
    }

    // 3) Nest HttpException (401/403/404/etc)
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resp: any = exception.getResponse();

      // Cho phép service tự nhét { code, message, details } vào HttpException response
      const code =
        resp?.code ||
        (statusCode === 401
          ? ErrorCode.UNAUTHORIZED
          : statusCode === 403
            ? ErrorCode.FORBIDDEN
            : statusCode === 404
              ? ErrorCode.NOT_FOUND
              : ErrorCode.INTERNAL);

      const message = resp?.message
        ? Array.isArray(resp.message)
          ? resp.message.join(', ')
          : String(resp.message)
        : exception.message || 'Request failed';

      body = {
        error: {
          code,
          // 4xx có thể expose message, 5xx không nên
          message: statusCode >= 500 ? 'Internal server error' : message,
          details: resp?.details,
        },
        traceId,
      };

      logger.warn({ traceId, method, path, statusCode, code, details: resp?.details }, message);
      return res.status(statusCode).json(body);
    }

    // 4) Unknown error (code bug, crash…): không leak message/stack ra client
    const err = exception as any;
    logger.error(
      {
        traceId,
        method,
        path,
        statusCode,
        // log nội bộ thôi (terminal), client không thấy
        errMessage: err?.message,
        errName: err?.name,
        errStack: err?.stack,
      },
      'unhandled_exception',
    );

    return res.status(statusCode).json(body);
  }
}
