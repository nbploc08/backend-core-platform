import { ErrorCode, ErrorCodes } from './error-codes';
import { ServiceError } from './service-error';

type AxiosLikeError = {
  response?: { status?: number; data?: unknown };
  message?: string;
};

function isAxiosLike(err: unknown): err is AxiosLikeError {
  return !!err && typeof err === 'object' && 'response' in err;
}

type ErrorBody = {
  // Legacy shape: { error: { code, message, details } }
  error?: { code?: string; message?: string; details?: unknown };
  // ApiResponse shape: { messageKey, message, errors }
  messageKey?: string;
  message?: string;
  errors?: unknown;
  [k: string]: unknown;
};

/**
 * Chuyển lỗi từ axios (hoặc lỗi có dạng { response: { status, data } }) thành ServiceError chuẩn.
 * Dùng trong catch khi gọi HTTP bằng axios.
 * @param err - Lỗi bắt được (thường từ axios)
 * @param defaultMessage - Message mặc định khi không lấy được từ response
 * @throws ServiceError
 */
export function handleAxiosError(err: unknown, defaultMessage = 'Request failed'): never {
  if (err instanceof ServiceError) {
    throw err;
  }
  if (isAxiosLike(err)) {
    const status = err.response?.status ?? 500;
    const body = err.response?.data as ErrorBody | undefined;

    // Support both ApiResponse shape ({ messageKey, message, errors })
    // and legacy shape ({ error: { code, message, details } })
    const codeFromBody = body?.messageKey ?? body?.error?.code;
    const code: ErrorCode =
      (codeFromBody as ErrorCode) ??
      (status === 401
        ? ErrorCodes.AUTH_TOKEN_INVALID
        : status === 404
          ? ErrorCodes.NOT_FOUND
          : ErrorCodes.INTERNAL);
    const message =
      body?.message ??
      body?.error?.message ??
      (err.message && String(err.message)) ??
      defaultMessage;
    const details = body?.errors ?? body?.error?.details;
    throw new ServiceError({
      code,
      statusCode: status,
      message,
      details: status >= 500 ? undefined : details,
    });
  }
  throw new ServiceError({
    code: ErrorCodes.INTERNAL,
    statusCode: 500,
    message: err instanceof Error ? err.message : defaultMessage,
  });
}
