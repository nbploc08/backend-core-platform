import { Module, DynamicModule } from '@nestjs/common';
import { ClsModule as NestClsModule } from 'nestjs-cls';
import { randomUUID } from 'crypto';
import { getReqLogger } from '../logging/logger';

/**
 * CommonClsModule - CLS (Continuation Local Storage) configuration for request tracking
 *
 * Features:
 * - Automatic requestId generation and propagation
 * - Attaches logger to request object
 * - Sets x-request-id header in response
 * - Can be reused across multiple microservices
 *
 * Usage:
 * @example
 * // In app.module.ts
 * imports: [
 *   CommonClsModule.forRoot(),
 *   // ... other modules
 * ]
 *
 * // In service
 * constructor(private readonly cls: ClsService) {}
 *
 * someMethod() {
 *   const requestId = this.cls.getId();
 *   // Use requestId for logging, tracking, etc.
 * }
 */
@Module({})
export class CommonClsModule {
  static forRoot(): DynamicModule {
    return {
      module: CommonClsModule,
      imports: [
        NestClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: (req) => req.headers['x-request-id'] || randomUUID(),
            setup: (cls, req, res) => {
              const rid = cls.getId();
              req.requestId = rid;
              req.log = getReqLogger(rid);
              res.setHeader('x-request-id', rid);
            },
          },
        }),
      ],
      exports: [NestClsModule],
    };
  }
}
