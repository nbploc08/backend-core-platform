import pino, { Logger } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const level = (process.env.LOG_LEVEL as LogLevel) || 'info';
const service = process.env.SERVICE_NAME || 'unknown-service';

// Base logger (dùng chung)
export const logger: Logger = pino({
  level,
  base: { service }, // mọi log tự có field service
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // tránh leak secrets trong log
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
    ],
    remove: true,
  },
});

/**
 * Tạo logger gắn requestId (request-scoped)
 * Dùng để mọi log của request đó đều có requestId.
 */
export function getReqLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
export default logger;
