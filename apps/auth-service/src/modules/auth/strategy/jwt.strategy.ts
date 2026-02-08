import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'change-me',
      issuer: configService.get<string>('JWT_ISSUER') || 'auth-service',
      audience: configService.get<string>('JWT_AUDIENCE') || 'api',
    });
  }

  async validate(payload: { sub: string; email: string; permVersion?: number }) {
    return {
      userId: payload.sub,
      email: payload.email,
      permVersion: payload.permVersion ?? 1,
    };
  }
}
