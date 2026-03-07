import { MESSAGE_KEYS, formatMessage } from './messages';

// Standard API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  messageKey: string;
  message: string;
  data?: T;
  errors?: string[];
  timestamp: string;
}

// Success response wrapper
export function successResponse<T>(
  data: T,
  messageKey: string = MESSAGE_KEYS.COMMON.SUCCESS,
  params?: Record<string, any>,
): ApiResponse<T> {
  return {
    success: true,
    messageKey,
    message: formatMessage(messageKey, params),
    data,
    timestamp: new Date().toISOString(),
  };
}

// Error response wrapper
export function errorResponse(
  messageKey: string,
  params?: Record<string, any>,
  errors?: string[],
): ApiResponse {
  return {
    success: false,
    messageKey,
    message: formatMessage(messageKey, params),
    errors,
    timestamp: new Date().toISOString(),
  };
}

// List response wrapper
export function listResponse<T>(
  data: T[],
  total: number,
  page?: number,
  limit?: number,
  messageKey: string = MESSAGE_KEYS.COMMON.LIST_FOUND,
): ApiResponse<{
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}> {
  return {
    success: true,
    messageKey,
    message: formatMessage(messageKey),
    data: {
      items: data,
      total,
      page,
      limit,
    },
    timestamp: new Date().toISOString(),
  };
}