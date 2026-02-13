import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class InternalJwtService {
  constructor(private config: ConfigService) {}

  signInternalToken(data: {}): string {
    const secret = this.config.get<string>('INTERNAL_JWT_SECRET') || 'change-internal';
    const issuer = this.config.get<string>('INTERNAL_JWT_ISSUER') || 'auth-service';
    const audience = this.config.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal';
    return jwt.sign({ sub: 'auth-service', data }, secret, {
      issuer,
      audience,
      expiresIn: '5m',
    });
  }
}
