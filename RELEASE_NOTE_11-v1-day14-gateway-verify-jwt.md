# Release Note

- **Release date**: 09/02/2026
- **Scope**: Gateway (verify user JWT, internal JWT) + Auth Service (internal endpoints) + Notification Service
- **Device**: Backend API (NestJS) — gateway, auth-service, notification-service
- **Branch**: `11-v1-day14-gateway-verify-jwt`

## Overview

- **Gateway** xác thực **user JWT** (token do auth-service cấp) cho mọi route, trừ các route đánh dấu `@Public()`.
- **Gateway** khi gọi auth-service (login, register, verify, refresh, me, …) ký **Internal JWT** và gửi `Authorization: Bearer <internal_jwt>` + `x-request-id`.
- **Auth-service** expose nhóm endpoint **internal** (`auth/internal/*`) bảo vệ bằng **Internal JWT** (chỉ chấp nhận token do gateway ký); user JWT gửi trực tiếp tới internal route sẽ bị từ chối.
- **Notification-service**: cập nhật JetStream consumer (cấu hình/flow xử lý event).

## Changes

### Gateway

- **User JWT verification (global)**
  - `APP_GUARD` = `JwtAuthGuard`: mọi route yêu cầu Bearer token (user JWT) trừ khi có `@Public()`.
  - `UserJwtStrategy`: verify token với `JWT_SECRET`, `JWT_ISSUER` (auth-service), `JWT_AUDIENCE` (api); `validate()` trả `{ userId, email, permVersion }`.

- **Internal JWT (gateway → auth-service)**
  - Module `InternalJwtModule` + `InternalJwtService`: ký Internal JWT với `INTERNAL_JWT_SECRET`, issuer `gateway`, audience `internal`, expires 5m; payload `{ sub: 'gateway', data }`.
  - `AuthClientService`: mỗi request tới auth-service đều gọi `internalJwt.signInternalToken(payload)` và gửi header `Authorization: Bearer <token>`, `x-request-id`.

- **Auth client controller**
  - Route public: `POST login`, `POST register`, `POST register/verify`, `POST register/verify/confirm`, `POST resend-code`, `POST refresh`.
  - Route bảo vệ bởi user JWT: `GET me` (sau đó gateway gọi auth-service internal với internal JWT + userId).

- **Cấu hình**
  - `.env.example`: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` (user JWT); `INTERNAL_JWT_SECRET`, `INTERNAL_JWT_ISSUER`, `INTERNAL_JWT_AUDIENCE` (internal JWT).

### Auth Service

- **Internal JWT strategy + guard**
  - `InternalJwtStrategy` (trong `modules/auth/strategy/jwt.strategy.ts`): verify Bearer token với `INTERNAL_JWT_SECRET`, issuer `gateway`, audience `internal`; `validate(payload)` trả `{ caller, data }`.
  - `InternalJwtAuthGuard`: `AuthGuard('internal-jwt')`.
  - Global guard: dùng `InternalJwtAuthGuard` (hoặc bỏ qua path `auth/internal/*` cho user JWT guard để internal controller tự bảo vệ bằng internal JWT).

- **Internal controller**
  - Controller prefix `auth/internal`: login, register, verify, refresh, me, … chỉ chấp nhận request có Internal JWT do gateway gửi.

- **Loại bỏ module internal cũ**
  - Xóa `modules/internal/*` (internal.controller, internal.module, internal-jwt-auth.guard, internal-jwt.strategy riêng); logic gộp vào auth module (auth controller prefix `auth/internal`, strategy trong auth/strategy).

### Notification Service

- **JetStream consumer**
  - Cập nhật `jetstream-consumer.service.ts` (cấu hình consumer, handler, hoặc flow xử lý message).

### Backend API — Các endpoint liên quan

| Service     | Method | Path                         | Mô tả                                                                 |
| ----------- | ------ | ---------------------------- | --------------------------------------------------------------------- |
| Gateway     | GET    | /client/auth/me              | Cần user JWT; gateway gọi auth internal với internal JWT → trả profile. |
| Gateway     | POST   | /client/auth/login           | Public; gateway gọi auth/internal/login với internal JWT.            |
| Gateway     | POST   | /client/auth/register        | Public; gateway gọi auth/internal/register với internal JWT.         |
| Gateway     | POST   | /client/auth/refresh         | Public; cookie refreshToken, deviceId.                               |
| Auth-service| *      | /auth/internal/*             | Chỉ chấp nhận Internal JWT (gateway); không chấp nhận user JWT.      |

## Migration

- **Migration required**: No

## Dependencies

- **Added**: (không thêm package mới — gateway đã có `@nestjs/jwt`, `passport-jwt`, `jsonwebtoken` nếu dùng)
- **Unchanged**: Các dependency hiện có đủ cho Internal JWT và user JWT.

## Affected files (tham khảo)

**Gateway**

- `apps/gateway/src/app.module.ts`
- `apps/gateway/src/modules/internal-jwt/internal-jwt.service.ts`
- `apps/gateway/src/modules/internal-jwt/internal-jwt.module.ts`
- `apps/gateway/src/modules/client/auth/auth-client.module.ts`
- `apps/gateway/src/modules/client/auth/auth-client.service.ts`
- `apps/gateway/src/modules/client/auth/auth-client.controller.ts`
- `apps/gateway/src/modules/client/auth/strategy/jwt-auth.guard.ts`
- `apps/gateway/src/modules/client/auth/strategy/user-jwt.strategy.ts`
- `apps/gateway/.env.example`

**Auth-service**

- `apps/auth-service/src/app.module.ts`
- `apps/auth-service/src/modules/auth/auth.controller.ts`
- `apps/auth-service/src/modules/auth/auth.module.ts`
- `apps/auth-service/src/modules/auth/strategy/jwt.strategy.ts` (InternalJwtStrategy)
- `apps/auth-service/src/modules/auth/strategy/jwt-auth.guard.ts` (InternalJwtAuthGuard)
- (Đã xóa: `apps/auth-service/src/modules/internal/*`)

**Notification-service**

- `apps/notification-service/src/modules/jetstream/jetstream-consumer.service.ts`
