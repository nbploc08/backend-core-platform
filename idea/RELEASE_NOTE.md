# Release Note

**Release date:** 08/02/2026  
**Scope:** Auth Service + Gateway + Shared packages (common, contracts)  
**Device:** Backend API (NestJS) — auth-service, gateway, packages/common, packages/contracts  
**Branch:** _(thay bằng tên branch hiện tại, ví dụ: `feat/auth-core-day10-12` hoặc `main`)_

---

## Overview

Hoàn thành các yêu cầu **Day 10, 11, 12, 13** (DAILY_SCHEDULE_CORE_V1): chuẩn hóa login/error, JWT (issuer/audience, permVersion), session với refresh token **hash (argon2)**, refresh rotation và logout.

- **Day 10:** Audit log `login_success` / `login_failed`; error code `AUTH_INVALID_CREDENTIALS` chuẩn.
- **Day 11:** JWT config thêm issuer/audience; claims có `sub`, `permVersion`, `iat`, `exp`; guard verify JWT; endpoint `/auth/info` trả thông tin user.
- **Day 12:** Refresh token được **hash (argon2)** trước khi lưu DB; verify bằng hash khi refresh và logout-device.
- **Day 13:** Refresh rotation, logout-device, logout-all; error codes chuẩn; refresh cũ bị revoke khi rotate.

---

## Changes

### Auth Service

**Login + Audit log (Day 10)**

- `AuthService.login`: ghi `logger.info({ action: 'login_success', userId, email })` khi login thành công.
- `LocalStrategy.validate`: ghi `logger.warn({ action: 'login_failed', email, reason: 'invalid_credentials' })` khi sai credential.
- `AuthService.login`: ghi `login_failed` khi account chưa verify hoặc lỗi khác (reason: `account_not_verified` hoặc message).

**JWT config + claims (Day 11)**

- `AuthModule`: `JwtModule.registerAsync` bổ sung `signOptions`: `issuer` (JWT_ISSUER), `audience` (JWT_AUDIENCE), `expiresIn`.
- `AuthService.issueTokens`: payload gồm `{ sub, email, permVersion }` (permVersion từ user, mặc định 1).
- `AuthService.refresh`: gọi `jwtService.verify(..., { issuer, audience })`.
- `JwtStrategy` (auth-service): options thêm `issuer`, `audience`; `validate()` trả `{ userId, email, permVersion }`.
- `UserInterface`: thêm field `permVersion?: number`.

**Session + refresh token hashed (Day 12)**

- `UsersService.saveRefreshToken`: hash refresh token bằng `hashPassword` (argon2) trước khi ghi vào `tokenHash`; tìm session theo `(userId, deviceId)`; khi rotate thì verify token cũ bằng `verifyPassword` rồi cập nhật hash mới.
- `UsersService.findByRefreshToken`: tìm `RefreshToken` theo `userId` + `deviceId` (còn hạn, chưa revoke), sau đó `verifyPassword(record.tokenHash, refreshToken)`; nếu đúng thì trả user.
- `UsersService.logoutDevice`: tìm session theo `userId` + `deviceId`, verify token bằng hash, rồi set `revokedAt`.

**Refresh + logout (Day 13)**

- Đã có sẵn: `POST /auth/refresh`, `POST /auth/logout-device`, `POST /auth/logout-all`; error code `AUTH_REFRESH_TOKEN_INVALID`; rotation revoke token cũ.

**Khác**

- `main.ts`: khi port bận (EADDRINUSE) thử các port tiếp theo (tối đa 5 lần).
- `apps/auth-service/.env.example`: thêm `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.

### Packages (common)

- `packages/common`: export `JwtAuthGuard`, `JwtStrategy`, `JWT_SECRET_KEY` (injection token), `jwt.constants`.
- `JwtStrategy` (common): nhận secret qua `@Inject(JWT_SECRET_KEY)` (app cung cấp provider).
- `tsconfig.json`: bật `experimentalDecorators`, `emitDecoratorMetadata` để DI hoạt động đúng.

### Auth-service dùng local guard/strategy

- `AppModule`: dùng `JwtAuthGuard` từ `./modules/auth/strategy/jwt-auth.guard` (local) thay vì `@common/core` để tránh lỗi Reflector undefined.
- `AuthModule`: dùng `JwtStrategy` từ `./strategy/jwt.strategy` (local) và provider `JWT_SECRET_KEY` (useFactory từ ConfigService) khi dùng secret từ common.

### Backend API — Các endpoint liên quan

| Method | Path                | Mô tả                                                        |
| ------ | ------------------- | ------------------------------------------------------------ |
| POST   | /auth/login         | Login; trả access_token + set cookie refreshToken, deviceId. |
| POST   | /auth/refresh       | Đổi refresh token (rotate); cookie refreshToken, deviceId.   |
| GET    | /auth/info          | Thông tin user (cần Bearer token).                           |
| POST   | /auth/logout-device | Revoke session theo device.                                  |
| POST   | /auth/logout-all    | Revoke toàn bộ session user.                                 |

---

## Migration

**Migration required:** No (không đổi schema Prisma).

**Lưu ý:** Các session (bản ghi `refreshTokens`) được tạo **trước** khi bật hash sẽ không verify được (vì `tokenHash` cũ lưu raw JWT). User cần đăng nhập lại để tạo session mới. Có thể chạy script revoke toàn bộ session cũ nếu cần.

---

## Dependencies

**Added:** Không thêm dependency mới (đã dùng argon2, @nestjs/jwt, passport-jwt trong auth-service và common).

**Affected:** `packages/common/package.json` (peerDependencies: @nestjs/common, @nestjs/core, @nestjs/passport, @nestjs/config, passport, passport-jwt).

---

## Affected files (tham khảo)

```
apps/auth-service/
  src/main.ts
  src/app.module.ts
  src/entities/user.entities.ts
  src/modules/auth/
    auth.module.ts
    auth.service.ts
    auth.controller.ts
    strategy/jwt.strategy.ts
    strategy/jwt-auth.guard.ts
    passport/local.strategy.ts
  src/modules/users/users.service.ts
  .env.example

packages/common/
  src/auth/jwt.strategy.ts
  src/auth/jwt-auth.guard.ts
  src/auth/jwt.constants.ts
  src/index.ts
  tsconfig.json
  package.json

idea/
  CHECK_DAY_10_13.md
  RELEASE_NOTE.md (file này)
```

---

_Cập nhật **Branch** ở đầu file bằng tên branch thực tế trước khi release._
