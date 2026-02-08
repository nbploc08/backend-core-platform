# Day 14 — Hướng dẫn Internal endpoint + Internal JWT

Mục tiêu: Client gọi **gateway** `GET /me` → Gateway verify **user JWT** → Gateway gọi **auth-service** bằng **internal JWT** → Auth-service internal endpoint verify internal JWT và trả profile → Gateway trả lại client. Kèm **propagation requestId** khi gateway gọi auth-service.

---

## 1. Tổng quan luồng

```
Client
  │  GET /me
  │  Authorization: Bearer <user_access_token>
  ▼
Gateway
  │  1) Verify user JWT → userId
  │  2) Tạo internal JWT (payload: sub='gateway', userId)
  │  3) Gọi auth-service với internal JWT + x-request-id
  ▼
Auth-service
  │  GET /internal/profile (hoặc /internal/users/:userId)
  │  Authorization: Bearer <internal_jwt>
  │  x-request-id: <req.requestId>
  │  4) Verify internal JWT → chỉ chấp nhận từ gateway
  │  5) Lấy userId từ payload/header → UsersService.getProfileById(userId)
  │  6) Trả profile
  ▼
Gateway trả profile cho client
```

---

## 2. Internal JWT — quy ước chung

- **Secret:** `INTERNAL_JWT_SECRET` — dùng chung giữa gateway và auth-service (và sau này các service khác). **Khác** với `JWT_SECRET` (user token).
- **Issuer:** gateway ký token với `iss: 'gateway'` (hoặc `'platform'`). Auth-service verify `issuer === 'gateway'`.
- **Audience:** `aud: 'internal'` — để phân biệt internal token với user token.
- **Payload internal (gateway → auth):** ví dụ `{ sub: 'gateway', userId: '<userId>', iat, exp }` — auth-service đọc `userId` để trả profile đúng user.

---

## 3. Auth-service — việc cần làm

### 3.1. Biến môi trường

Thêm vào `apps/auth-service/.env.example` và `.env`:

```env
# Internal JWT (service-to-service) — cùng giá trị với gateway
INTERNAL_JWT_SECRET=your-internal-jwt-secret-change-in-production
INTERNAL_JWT_ISSUER=gateway
INTERNAL_JWT_AUDIENCE=internal
```

### 3.2. Internal JWT Strategy + Guard

- **Tạo strategy** verify internal JWT (Passport):
  - File gợi ý: `apps/auth-service/src/modules/auth/strategy/internal-jwt.strategy.ts`
  - Extract token: `Authorization: Bearer <token>` (hoặc header riêng `X-Internal-Token` nếu muốn tách hẳn với user JWT).
  - Options: `secretOrKey: INTERNAL_JWT_SECRET`, `issuer: INTERNAL_JWT_ISSUER`, `audience: INTERNAL_JWT_AUDIENCE`.
  - `validate(payload)`: payload có `sub`, `userId`. Trả về object kiểu `{ caller: payload.sub, userId: payload.userId }` để controller dùng.

- **Tạo guard** cho internal:
  - File gợi ý: `apps/auth-service/src/modules/auth/strategy/internal-jwt-auth.guard.ts`
  - Dùng `AuthGuard('internal-jwt')` (tên strategy đăng ký trong PassportStrategy).

- **Đăng ký strategy:** Trong `AuthModule`, thêm `InternalJwtStrategy` vào `providers`. Strategy cần `PassportStrategy(Strategy, 'internal-jwt')` (tên thứ hai là key).

### 3.3. Internal controller + endpoint

- **Cách 1 — Controller riêng:** Tạo `apps/auth-service/src/modules/internal/internal.controller.ts` (và `internal.module.ts` nếu tách module).
  - Route: `GET /internal/profile` (hoặc `GET /internal/users/me`).
  - Dùng `UseGuards(InternalJwtGuard)`.
  - Trong handler: lấy `userId` từ `req.user.userId` (do internal strategy trả về). Gọi service lấy profile theo `userId`.

- **Cách 2 — Trong AuthModule:** Thêm controller `InternalController` với prefix `internal`, route `GET profile` → full path `GET /internal/profile`. Guard = InternalJwtGuard.

- **Service layer:** Hiện `UsersService.info(user)` nhận `UserInterface` (có `id`). Có thể:
  - Thêm method `getProfileById(userId: string): Promise<InfoUserDto>` trong `UsersService` (select giống `info`, nhưng `where: { id: userId }`), **hoặc**
  - Gọi `UsersService.info({ id: userId } as UserInterface)` nếu bạn giữ đúng type.

- **Public:** Internal controller **không** dùng `@Public()`. Chỉ internal JWT mới qua được guard. User JWT gửi tới sẽ fail vì sai secret/issuer/audience.

### 3.4. Global guard

- Auth-service đang dùng `APP_GUARD` = `JwtAuthGuard` (user JWT). Route `/internal/*` không nên dùng user JWT.
  - Có thể: đánh dấu toàn bộ route internal bằng metadata (ví dụ `@Internal()`) và trong guard user JWT: nếu là internal route thì bỏ qua (để InternalJwtGuard xử lý). **Hoặc**
  - Đơn giản hơn: Internal controller **không** dùng global JwtAuthGuard — chỉ dùng `UseGuards(InternalJwtGuard)`. Cần đảm bảo global guard bỏ qua path `/internal/*` (trong JwtAuthGuard: `reflector` hoặc check `req.path` → nếu bắt đầu bằng `/internal` thì `canActivate` return true để Passport không chặn, nhưng sau đó InternalJwtGuard mới chạy; thực tế thứ tự guard: controller guard chạy sau global, nên cần global guard **skip** internal routes). Cách sạch: trong global guard, nếu path là `/internal/*` thì `return true` (để request đi tiếp), và controller internal dùng `UseGuards(InternalJwtGuard)` — khi đó chỉ internal JWT mới qua được InternalJwtGuard; user JWT sẽ fail ở InternalJwtGuard vì verify sai secret. **Kết luận:** Global JwtAuthGuard cần **bỏ qua** các route có prefix `/internal` (hoặc metadata `@Internal()`), để internal controller tự bảo vệ bằng InternalJwtGuard.

### 3.5. Tóm tắt file auth-service

| Việc | File / vị trí |
|------|----------------|
| Env | `.env.example` + `.env`: `INTERNAL_JWT_*` |
| Strategy | `modules/auth/strategy/internal-jwt.strategy.ts` |
| Guard | `modules/auth/strategy/internal-jwt-auth.guard.ts` |
| Controller | `modules/internal/internal.controller.ts` (hoặc trong auth module) |
| Service | `UsersService.getProfileById(userId)` hoặc dùng `info({ id: userId })` |
| AuthModule | Import InternalController, provider InternalJwtStrategy |
| Global guard | Bỏ qua path `/internal/*` (hoặc metadata @Internal()) |

---

## 4. Gateway — việc cần làm

### 4.1. Biến môi trường

Thêm vào `apps/gateway/.env.example` và `.env`:

```env
# User JWT (verify token do auth-service cấp cho client)
JWT_SECRET=your-jwt-secret-change-in-production
JWT_ISSUER=auth-service
JWT_AUDIENCE=api

# Auth-service URL (gọi internal endpoint)
AUTH_SERVICE_URL=http://localhost:3001

# Internal JWT (gateway ký khi gọi auth-service) — cùng INTERNAL_JWT_* với auth-service
INTERNAL_JWT_SECRET=your-internal-jwt-secret-change-in-production
INTERNAL_JWT_ISSUER=gateway
INTERNAL_JWT_AUDIENCE=internal
```

(Giả sử auth-service chạy port 3001; gateway 3000.)

### 4.2. Verify user JWT tại gateway

- Gateway cần verify **user** JWT (access token của client) để lấy `userId`.
  - Dùng `JwtStrategy` + `JwtAuthGuard` từ `packages/common` **nếu** common hỗ trợ issuer/audience (giống auth-service). Hiện `packages/common/src/auth/jwt.strategy.ts` chưa có issuer/audience → cần bổ sung options `issuer`, `audience` từ ConfigService (giống auth-service), **hoặc** gateway tự có file strategy riêng copy từ auth-service (secret/issuer/audience user JWT).
- Đăng ký: `JwtModule` (user), `JwtStrategy` (user), `JwtAuthGuard` global; route public (health, v.v.) dùng `@Public()`.

### 4.3. Tạo internal JWT khi gọi auth-service

- Gateway cần **ký** internal JWT (không verify). Dùng `JwtModule` với config **internal**:
  - Secret: `INTERNAL_JWT_SECRET`
  - signOptions: `issuer: INTERNAL_JWT_ISSUER`, `audience: INTERNAL_JWT_AUDIENCE`, `expiresIn: '5m'` (ngắn, đủ cho 1 request).
- Có thể tạo provider/service: `InternalJwtService` (inject `JwtService` với token `INTERNAL_JWT_MODULE` hoặc dùng 1 JwtModule cho user verify và 1 JwtModule đăng ký tên khác cho internal sign). Cách đơn giản: đăng ký 2 JwtModule — 1 cho user (verify), 1 cho internal (sign), inject bằng token riêng (NestJS `@Inject(JwtService)` có thể dùng namespace hoặc custom provider). Hoặc 1 module: JwtModule dùng cho verify user; thêm một service `InternalJwtService` dùng `@nestjs/jwt` JwtService với config internal (registerAsync với token `INTERNAL_JWT_SIGN_OPTIONS`). Thực tế đơn giản: **Gateway chỉ cần ký**, nên tạo một **InternalJwtService** inject ConfigService và JwtService (cần JwtModule.register với secret + options internal). Đăng ký JwtModule thứ 2 với tên/custom provider cho internal sign.
- Method: `signInternalToken(userId: string): string` — payload `{ sub: 'gateway', userId }`, ký bằng INTERNAL_JWT_SECRET.

### 4.4. HTTP client gọi auth-service + propagation requestId

- Cài `@nestjs/axios` và `axios` (hoặc dùng `HttpService` của Nest). Import `HttpModule` trong gateway.
- Tạo service: `AuthClientService` (hoặc `AuthProxyService`):
  - Inject `HttpService`, `ConfigService`, `InternalJwtService`, và có cách lấy `requestId` (từ request scope — xem bên dưới).
  - Method: `getProfileByUserId(userId: string, requestId: string): Promise<InfoUserDto>`:
    - Internal token = `this.internalJwtService.signInternalToken(userId)`.
    - GET `{AUTH_SERVICE_URL}/internal/profile` (và truyền userId — có thể query `?userId=xxx` hoặc auth-service đọc từ internal JWT payload). Nếu auth-service đọc userId từ JWT thì không cần query.
    - Headers: `Authorization: Bearer <internal_token>`, `x-request-id: requestId`.
    - Return body (profile).
- **RequestId:** Gateway cần truyền `req.requestId` vào `getProfileByUserId`. Trong controller GET /me: sau khi có `req.user` (từ guard), gọi `this.authClientService.getProfileByUserId(req.user.userId, req.requestId)`. Đảm bảo middleware requestId đã set `req.requestId`.

### 4.5. Route GET /me

- Controller (ví dụ `AppController` hoặc `MeController`):
  - `GET /me` (hoặc `/auth/me` tùy quy ước).
  - `@UseGuards(JwtAuthGuard)` (user JWT), không `@Public()`.
  - Handler: lấy `@User() user`, `@Req() req` → `userId = user.userId`, `requestId = req.requestId` → gọi `AuthClientService.getProfileByUserId(userId, requestId)` → return profile.
- Nếu auth-service trả đúng format (id, email, name, phone, isActive) thì gateway trả nguyên.

### 4.6. Xử lý lỗi từ auth-service

- Khi gọi HTTP auth-service: nếu 4xx/5xx, gateway nên map sang `ServiceError` và format chuẩn (traceId = requestId). Ví dụ: 401 từ auth → `AUTH_TOKEN_INVALID` hoặc `UNAUTHORIZED`; 500 → `INTERNAL`. Trả response chuẩn cho client.

### 4.7. Tóm tắt file gateway

| Việc | File / vị trí |
|------|----------------|
| Env | `.env.example` + `.env`: `JWT_*`, `AUTH_SERVICE_URL`, `INTERNAL_JWT_*` |
| User JWT verify | Dùng common JwtStrategy (bổ sung issuer/audience) hoặc gateway copy strategy auth-service; JwtModule (user), JwtAuthGuard global, @Public() cho health |
| Internal JWT sign | JwtModule (internal) + InternalJwtService (signInternalToken(userId)) |
| HTTP client | HttpModule, AuthClientService (getProfileByUserId(userId, requestId)), headers Authorization + x-request-id |
| Route /me | Controller GET /me, guard user JWT, gọi AuthClientService.getProfileByUserId(req.user.userId, req.requestId) |
| Error map | AuthClientService khi response không 2xx → throw ServiceError, traceId = requestId |

---

## 5. Thứ tự implement gợi ý

1. **Auth-service:** Thêm env INTERNAL_JWT_* → Internal JWT Strategy + Guard → UsersService.getProfileById (nếu chưa có) → Internal controller GET /internal/profile → Global guard bỏ qua /internal/*.
2. **Gateway:** Thêm env (user JWT + AUTH_SERVICE_URL + internal JWT) → User JWT verify (strategy + guard) + route /me tạm trả req.user (không gọi auth) để test → InternalJwtService (sign) → HttpModule + AuthClientService (getProfileByUserId, x-request-id) → GET /me gọi AuthClientService.
3. **E2E:** Client login qua auth-service (hoặc gateway proxy login) lấy access_token → gọi gateway GET /me với Bearer token → nhận profile; kiểm tra header x-request-id và traceId trong response lỗi.

---

## 6. Kiểm tra nhanh

- Gửi **user JWT** tới auth-service `GET /internal/profile`: phải **401** (auth-service chỉ chấp nhận internal JWT).
- Gửi **internal JWT** (gateway ký) + header `x-request-id` tới auth-service `GET /internal/profile`: phải 200 và trả profile (auth-service đọc userId từ payload internal JWT).
- Client gọi gateway `GET /me` với user Bearer token: 200, body là profile; log auth-service có request với x-request-id trùng gateway.

---

## 7. Ghi chú Tuần 4

- Tuần 4 sẽ chuẩn hóa thêm: gateway forward `/auth/*` sang auth-service với internal JWT; có thể mở rộng internal JWT cho nhiều service (issuer = từng service, auth-service verify danh sách issuer). Day 14 chỉ cần 1 issuer (gateway) là đủ.
