// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { PassportStrategy } from '@nestjs/passport';
// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';

// export type InternalJwtPayload = {
//   sub: string;
//   userId: string;
//   iat?: number;
//   exp?: number;
// };

// @Injectable()
// export class InternalJwtStrategy extends PassportStrategy(
//   Strategy,
//   'internal-jwt',
// ) {
//   constructor(private configService: ConfigService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey:
//         configService.get<string>('INTERNAL_JWT_SECRET') || 'change-internal',
//       issuer: configService.get<string>('INTERNAL_JWT_ISSUER') || 'gateway',
//       audience:
//         configService.get<string>('INTERNAL_JWT_AUDIENCE') || 'internal',
//     });
//   }

//   async validate(payload: InternalJwtPayload) {
//     return {
//       caller: payload.sub,
//       userId: payload.userId,
//     };
//   }
// }
