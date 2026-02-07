import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logger } from '../logging/logger';
import { ErrorCode, ErrorCodes } from './error-codes';
import { ServiceError } from './service-error';

type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  traceId?: string;
};

type LogEntry = {
  level: 'warn' | 'error';
  bindings: Record<string, unknown>;
  msg: string;
};

/** 404 từ browser/DevTools — không log để tránh rác */
const SKIP_LOG_404_PATHS = new Set([
  '/.well-known/appspecific/com.chrome.devtools.json',
  '/favicon.ico',
]);

function shouldSkipLog404(path: string | undefined): boolean {
  return path != null && SKIP_LOG_404_PATHS.has(path);
}

function safeLog(entry: LogEntry): void {
  try {
    if (entry.level === 'error') {
      logger.error(entry.bindings, entry.msg);
    } else {
      logger.warn(entry.bindings, entry.msg);
    }
  } catch {
    const out = entry.level === 'error' ? console.error : console.warn;
    out(`[${entry.level}]`, entry.msg, entry.bindings);
  }
}

function defaultCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.TOO_MANY_REQUESTS;
    default:
      return ErrorCodes.INTERNAL;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ requestId?: string; method?: string; originalUrl?: string; url?: string }>();
    const res = ctx.getResponse();

    const traceId = req?.requestId;
    const method = req?.method;
    const path = req?.originalUrl ?? req?.url;
    const baseBindings = { traceId, method, path };

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
      traceId,
    };
    let logEntry: LogEntry | null = null;

    // 1) Business error (ServiceError)
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
      logEntry = {
        level: statusCode >= 500 ? 'error' : 'warn',
        bindings: { ...baseBindings, statusCode, code: exception.code, details: exception.details },
        msg: exception.message,
      };
    }
    // 2) Validation (BadRequestException)
    else if (exception instanceof BadRequestException) {
      statusCode = exception.getStatus();
      const resp = exception.getResponse() as { message?: unknown };
      const details = resp?.message;
      body = {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details,
        },
        traceId,
      };
      logEntry = {
        level: 'warn',
        bindings: { ...baseBindings, statusCode, details },
        msg: 'validation_failed',
      };
    }
    // 3) Nest HttpException (401/403/404/409/...) - use duck typing to handle multiple @nestjs/common versions
    else if (
      exception != null &&
      typeof exception === 'object' &&
      'getStatus' in exception &&
      typeof (exception as HttpException).getStatus === 'function'
    ) {
      const httpEx = exception as HttpException;
      statusCode = httpEx.getStatus();
      const resp = httpEx.getResponse() as {
        code?: ErrorCode;
        message?: string | string[];
        details?: unknown;
      };
      const code = resp?.code ?? defaultCodeForStatus(statusCode);
      const message =
        resp?.message != null
          ? Array.isArray(resp.message)
            ? resp.message.join(', ')
            : String(resp.message)
          : httpEx.message ?? 'Request failed';

      body = {
        error: {
          code,
          message: statusCode >= 500 ? 'Internal server error' : message,
          details: resp?.details,
        },
        traceId,
      };
      if (!(statusCode === 404 && shouldSkipLog404(path))) {
        logEntry = {
          level: 'warn',
          bindings: { ...baseBindings, statusCode, code, details: resp?.details },
          msg: message,
        };
      }
    }
    // 4) Unknown error — log message để debug (config/env, v.v.), response vẫn "Internal server error"
    else {
      const errMsg =
        exception instanceof Error ? exception.message : 'unhandled_exception';
      logEntry = {
        level: 'error',
        bindings: { ...baseBindings, statusCode, errorMessage: errMsg },
        msg: 'unhandled_exception',
      };
    }

    if (logEntry) {
      try {
        safeLog(logEntry);
      } catch {
        // bỏ qua nếu log lỗi, vẫn trả response
      }
    }

    if (!res.headersSent) {
      res.status(statusCode).json(body);
    }
  }
}
