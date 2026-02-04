import { ErrorCode, ErrorCodes } from './error-codes';

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  /**
   * exposeMessage:
   * - true: trả message đúng ra client (dùng cho lỗi nghiệp vụ an toàn: login sai, not found…)
   * - false: client chỉ thấy message chung (dùng cho lỗi nhạy cảm)
   */
  public readonly exposeMessage: boolean;

  constructor(params: {
    code: ErrorCode;
    statusCode: number;
    message: string;
    details?: unknown;
    exposeMessage?: boolean; // default true
  }) {
    super(params.message);

    this.code = params.code ?? ErrorCodes.INTERNAL;
    this.statusCode = params.statusCode ?? 500;
    this.details = params.details;
    this.exposeMessage = params.exposeMessage ?? true;
  }
}
