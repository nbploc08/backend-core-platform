import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type InternalJwtPayload = {
  sub: string;
  data: {};
};

@Injectable()
export class InternalJwtStrategy extends PassportStrategy(Strategy, 'internal-jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('INTERNAL_JWT_SECRET') || 'change-internal',
      audience: configService.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal',
    });
  }

  async validate(payload: InternalJwtPayload) {
    return {
      caller: payload.sub,
      data: payload.data,
    };
  }
}
