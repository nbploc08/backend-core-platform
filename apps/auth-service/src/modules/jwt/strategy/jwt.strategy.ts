import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Payload từ Internal JWT (gateway/service gọi service)
 */
export type InternalJwtPayload = {
  sub: string; // 'gateway' | 'auth-service' | 'notification-service'
  data: {
    id?: string; // userId nếu có
    [key: string]: unknown;
  };
  iss: string; // issuer
  aud: string; // audience
};

/**
 * Payload từ User JWT (user token)
 */
export type UserJwtPayload = {
  sub: string; // userId
  email: string;
  permVersion: number;
  iss: string;
  aud: string;
};

/**
 * Kết quả trả về từ validate()
 */
export type JwtValidationResult = {
  type: 'internal' | 'user';
  // Internal JWT fields
  caller?: string;
  data?: Record<string, unknown>;
  // User JWT fields
  userId?: string;
  email?: string;
  permVersion?: number;
};

/**
 * Combined JWT Strategy
 *
 * Auth-service cần xử lý 2 loại token:
 * 1. Internal JWT: Gateway/services gọi internal endpoints (ký bằng INTERNAL_JWT_SECRET)
 * 2. User JWT: Gateway forward user token (ký bằng JWT_SECRET)
 *
 * Strategy này sẽ:
 * - Decode token để xem audience
 * - Dựa vào audience chọn secret phù hợp để verify
 * - Trả về kết quả với type để controller biết đang xử lý loại nào
 */
@Injectable()
export class CombinedJwtStrategy extends PassportStrategy(Strategy, 'combined-jwt') {
  private readonly internalSecret: string;
  private readonly internalAudience: string;
  private readonly userSecret: string;
  private readonly userIssuer: string;
  private readonly userAudience: string;

  constructor(private configService: ConfigService) {
    // Lấy config
    const internalSecret = configService.get<string>('INTERNAL_JWT_SECRET');
    const userSecret = configService.get<string>('JWT_SECRET');
    const internalAudience = configService.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal';
    const userAudience = configService.get<string>('JWT_AUDIENCE') || 'api';

    // Validate required secrets
    if (!internalSecret) {
      throw new Error('INTERNAL_JWT_SECRET is required');
    }
    if (!userSecret) {
      throw new Error('JWT_SECRET is required');
    }

    // Options cho passport-jwt
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Dùng secretOrKeyProvider để chọn secret dựa trên audience
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secret?: string | Buffer) => void,
      ) => {
        try {
          // Decode token không verify để xem audience
          const decoded = jwt.decode(rawJwtToken) as { aud?: string } | null;

          if (!decoded) {
            return done(new UnauthorizedException('Invalid token format'));
          }

          // Xác định loại token dựa trên audience
          const audience = decoded.aud;

          if (audience === internalAudience) {
            // Internal JWT
            return done(null, internalSecret);
          } else if (audience === userAudience) {
            // User JWT
            return done(null, userSecret);
          } else {
            return done(new UnauthorizedException(`Unknown token audience: ${audience}`));
          }
        } catch (error) {
          return done(new UnauthorizedException('Token decode failed'));
        }
      },
    };

    super(options);

    // Lưu config để dùng trong validate()
    this.internalSecret = internalSecret;
    this.internalAudience = internalAudience;
    this.userSecret = userSecret;
    this.userIssuer = configService.get<string>('JWT_ISSUER') || 'auth-service';
    this.userAudience = userAudience;
  }

  /**
   * Validate được gọi sau khi token đã được verify thành công
   * Payload chứa claims từ token
   */
  async validate(payload: InternalJwtPayload | UserJwtPayload): Promise<JwtValidationResult> {
    // Xác định loại token dựa trên audience
    if (payload.aud === this.internalAudience) {
      // Internal JWT
      const internalPayload = payload as InternalJwtPayload;
      return {
        type: 'internal',
        caller: internalPayload.sub,
        data: internalPayload.data as Record<string, unknown>,
      };
    } else if (payload.aud === this.userAudience) {
      // User JWT
      const userPayload = payload as UserJwtPayload;
      return {
        type: 'user',
        userId: userPayload.sub,
        email: userPayload.email,
        permVersion: userPayload.permVersion,
      };
    }

    throw new UnauthorizedException('Invalid token type');
  }
}

/**
 * Giữ lại InternalJwtStrategy cũ cho backward compatibility
 * Có thể dùng song song hoặc migrate dần sang CombinedJwtStrategy
 */
@Injectable()
export class InternalJwtStrategy extends PassportStrategy(Strategy, 'internal-jwt') {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('INTERNAL_JWT_SECRET');

    if (!secret) {
      throw new Error('INTERNAL_JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: configService.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal',
    });
  }

  async validate(payload: InternalJwtPayload) {
    return {
      type: 'internal' as const,
      caller: payload.sub,
      data: payload.data,
    };
  }
}
