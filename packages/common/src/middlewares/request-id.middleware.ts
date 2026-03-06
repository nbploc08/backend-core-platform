import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getReqLogger } from '../logging/logger';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const rid = req.headers['x-request-id'] || randomUUID();
    req.requestId = rid;
    req.log = getReqLogger(rid);
    res.setHeader('x-request-id', rid);
    next();
  }
}
