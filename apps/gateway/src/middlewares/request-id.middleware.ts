import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getReqLogger } from 'common';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const rid = randomUUID();
    req.requestId = rid;
    req.log = getReqLogger(rid); // <— dùng logger.ts ở đây
    res.setHeader('x-request-id', rid);
    next();
  }
}
