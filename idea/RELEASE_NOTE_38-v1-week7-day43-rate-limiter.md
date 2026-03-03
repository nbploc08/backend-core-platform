# Release Note

- **Release date**: 03/03/2026
- **Scope**: Advanced Rate Limiting (Redis) — per IP / email / userId / action
- **Device**: Backend API (NestJS) — packages/common, gateway, auth-service
- **Branch**: `38-v1-week7-day43-rate-limiter`

## Overview

Hoàn thành yêu cầu **Day 43** (DAILY_SCHEDULE_CORE_V1): Advanced rate limiting (Redis) per email/user/action.

- **RateLimiterModule** (`@common/core`): Reusable module với Redis-backed atomic Lua script, `@RateLimit()` decorator, `RateLimiterGuard` global guard.
- **Gateway**: Rate limiting trên tất cả auth endpoints (per IP + per email) và API endpoints (per userId + per action).
- **Auth-service**: Defense-in-depth rate limiting trên login, register, resend-code, refresh, forgot password endpoints.
- **Bugfix**: Sửa lỗi `forgotPasswordReset` thiếu internal JWT headers.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     CLIENT                           │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              GATEWAY (Port 3000)                     │
│  ┌────────────────────────────────────────────┐     │
│  │   RateLimiterGuard (Global APP_GUARD)      │     │
│  │   @RateLimit() per route:                  │     │
│  │   - Auth: per IP + per email               │     │
│  │   - Notifications: per userId (60/min)     │     │
│  │   - Roles: per userId (60/min)             │     │
│  │   - Write ops: stricter limits (10/min)    │     │
│  └────────────────────────────────────────────┘     │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │   RateLimiterService (Redis + Lua script)    │   │
│  │   Key: rl:{prefix}:{identifier}              │   │
│  │   Atomic INCR + PEXPIRE                      │   │
│  │   Fail-open on Redis error                   │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │ Internal JWT
                     ▼
┌─────────────────────────────────────────────────────┐
│           AUTH-SERVICE (Port 3001)                   │
│  ┌────────────────────────────────────────────┐     │
│  │   RateLimiterGuard (Global APP_GUARD)      │     │
│  │   @RateLimit() per route (defense-in-depth)│     │
│  │   - Login: per IP (10/min) + per email     │     │
│  │   - Register: per IP (5/min)               │     │
│  │   - Resend: per IP + per email             │     │
│  │   - Forgot: per IP + per email (10min)     │     │
│  │   - Refresh: per IP (20/min)               │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              REDIS (Port 6379)                       │
│   Rate limit keys: rl:{prefix}:{ip|hash|userId}    │
│   TTL: auto-expire (PEXPIRE in Lua script)          │
└─────────────────────────────────────────────────────┘
```

## Changes

### packages/common (`@common/core`)

**RateLimiterModule** (đã có từ trước, hoàn thiện)

- `RateLimiterModule.register(options?)`: Dynamic module, global, đọc `REDIS_URL` từ ConfigService.
- `RateLimiterService`: Redis-backed với atomic Lua script (fixed-window). Fail-open khi Redis down.
- `RateLimiterGuard`: Global guard, đọc `@RateLimit()` metadata. Hỗ trợ multiple rules (all must pass). Set response headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.
- `@RateLimit()` decorator: Hỗ trợ single rule hoặc array of rules.
- `keySource`: `'ip'`, `'userId'`, `'body.<field>'` (field value hashed với SHA-256).

### Gateway

**Auth endpoints** (`client/auth/*`) — đã có rate limit từ trước:

| Endpoint                                   | Rate Limits                        |
| ------------------------------------------ | ---------------------------------- |
| `POST /client/auth/login`                  | 10/min per IP + 5/min per email    |
| `POST /client/auth/register`               | 5/min per IP                       |
| `POST /client/auth/resend-code`            | 5/min per IP + 2/min per email     |
| `POST /client/auth/refresh`                | 20/min per IP                      |
| `POST /client/auth/forgot/password`        | 5/10min per IP + 2/10min per email |
| `POST /client/auth/forgot/password/verify` | 10/10min per IP                    |
| `POST /client/auth/forgot/password/reset`  | 5/10min per IP                     |

**Notification endpoints** (`client/notification/*`) — MỚI:

| Endpoint                             | Rate Limits                                   |
| ------------------------------------ | --------------------------------------------- |
| Controller-level (all endpoints)     | 60/min per userId                             |
| `POST /client/notification` (create) | 10/min per userId                             |
| `POST /client/notification/:id/read` | 30/min per userId                             |
| `POST /client/notification/read-all` | 10/min per userId                             |
| `GET` endpoints (list, unread-count) | Inherits controller-level (60/min per userId) |

**Role endpoints** (`client/roles/*`) — MỚI:

| Endpoint                           | Rate Limits                                   |
| ---------------------------------- | --------------------------------------------- |
| Controller-level (all endpoints)   | 60/min per userId                             |
| `POST /client/roles` (create)      | 10/min per userId                             |
| `POST /client/roles/assign-role`   | 10/min per userId                             |
| `POST /client/roles/unassign-role` | 10/min per userId                             |
| `GET`, `PATCH`, `DELETE` endpoints | Inherits controller-level (60/min per userId) |

**Bugfix**: `forgotPasswordReset` trong `auth-client.service.ts` — thêm `headers: this.getHeaders(requestId)` (trước đó thiếu internal JWT và `x-request-id`).

### Auth-service

**Rate limits bổ sung** (defense-in-depth):

| Endpoint                                     | Rate Limits (trước) | Rate Limits (sau)                 |
| -------------------------------------------- | ------------------- | --------------------------------- |
| `POST /auth/internal/register`               | ❌ Không có         | ✅ 5/min per IP                   |
| `POST /auth/internal/resend-code`            | ❌ Không có         | ✅ 5/min per IP + 2/min per email |
| `POST /auth/internal/login`                  | 10/min per IP       | ✅ + 5/min per email              |
| `POST /auth/internal/refresh`                | ❌ Không có         | ✅ 20/min per IP                  |
| `POST /auth/internal/forgot/password`        | 5/10min per IP      | ✅ + 2/10min per email            |
| `POST /auth/internal/forgot/password/verify` | ❌ Không có         | ✅ 10/10min per IP                |
| `POST /auth/internal/forgot/password/reset`  | ❌ Không có         | ✅ 5/10min per IP                 |

## Rate Limit Keys (Redis)

```
# Auth (Gateway layer)
rl:login:ip:<ip>                    → 10 req / 60s
rl:login:email:<sha256-hash>        → 5 req / 60s
rl:register:ip:<ip>                 → 5 req / 60s
rl:resend:ip:<ip>                   → 5 req / 60s
rl:resend:email:<sha256-hash>       → 2 req / 60s
rl:refresh:ip:<ip>                  → 20 req / 60s
rl:forgot:ip:<ip>                   → 5 req / 600s
rl:forgot:email:<sha256-hash>       → 2 req / 600s
rl:forgot-verify:ip:<ip>            → 10 req / 600s
rl:forgot-reset:ip:<ip>             → 5 req / 600s

# Auth (Auth-service layer — defense-in-depth)
rl:auth:register:ip:<ip>            → 5 req / 60s
rl:auth:resend:ip:<ip>              → 5 req / 60s
rl:auth:resend:email:<sha256-hash>  → 2 req / 60s
rl:auth:login:ip:<ip>               → 10 req / 60s
rl:auth:login:email:<sha256-hash>   → 5 req / 60s
rl:auth:refresh:ip:<ip>             → 20 req / 60s
rl:auth:forgot:ip:<ip>              → 5 req / 600s
rl:auth:forgot:email:<sha256-hash>  → 2 req / 600s
rl:auth:forgot-verify:ip:<ip>       → 10 req / 600s
rl:auth:forgot-reset:ip:<ip>        → 5 req / 600s

# API (Gateway layer — per userId)
rl:api:notification:<userId>        → 60 req / 60s
rl:api:notification:create:<userId> → 10 req / 60s
rl:api:notification:read:<userId>   → 30 req / 60s
rl:api:notification:read-all:<userId> → 10 req / 60s
rl:api:roles:<userId>               → 60 req / 60s
rl:api:roles:create:<userId>        → 10 req / 60s
rl:api:roles:assign:<userId>        → 10 req / 60s
rl:api:roles:unassign:<userId>      → 10 req / 60s
```

## Response Headers

Mỗi response có rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
Retry-After: 45          (chỉ khi bị 429)
```

## Error Response (429)

```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  },
  "traceId": "abc-123"
}
```

## Migration

- **Migration required**: No
- **Breaking changes**: No
- **Action required**: Không cần cài thêm dependency mới.

## Dependencies

- **Unchanged**: `ioredis` đã có trong root `package.json` và `@common/core` peer dependencies.

## Affected Files

**packages/common**

- `packages/common/src/rate-limiter/` — Đã có, không sửa (module hoàn chỉnh)
- `packages/common/dist/` — Rebuild

**Gateway**

- `apps/gateway/src/modules/client/notification-service/notification/notification.controller.ts` — Thêm `@RateLimit()` per userId
- `apps/gateway/src/modules/client/auth-service/role/role-client.controller.ts` — Thêm `@RateLimit()` per userId
- `apps/gateway/src/modules/client/auth-service/auth/auth-client.service.ts` — Bugfix: thêm headers cho `forgotPasswordReset`

**Auth-service**

- `apps/auth-service/src/modules/auth/auth.controller.ts` — Thêm `@RateLimit()` cho tất cả endpoints

## Usage Examples

### Single rule

```typescript
@RateLimit({ prefix: 'register:ip', limit: 5, window: 60, keySource: 'ip' })
@Post('register')
async register() { ... }
```

### Multiple rules (all must pass)

```typescript
@RateLimit([
  { prefix: 'login:ip', limit: 10, window: 60, keySource: 'ip' },
  { prefix: 'login:email', limit: 5, window: 60, keySource: 'body.email' },
])
@Post('login')
async login() { ... }
```

### Per-user API rate limiting

```typescript
@Controller('client/notification')
@RateLimit({ prefix: 'api:notification', limit: 60, window: 60, keySource: 'userId' })
export class NotificationController {
  @Post(':id/read')
  @RateLimit({ prefix: 'api:notification:read', limit: 30, window: 60, keySource: 'userId' })
  markRead() { ... }
}
```

### Controller-level + method-level

Khi cả controller và method đều có `@RateLimit()`, **method-level overrides controller-level** (NestJS Reflector behavior với `getAllAndOverride`).

## Testing

### Manual Test

```bash
# 1. Start gateway + auth-service
npm run dev:gateway
npm run dev:auth-service

# 2. Burst login requests (should get 429 after 10)
for ($i = 1; $i -le 15; $i++) {
  Invoke-WebRequest -Uri "http://localhost:3000/client/auth/login" `
    -Method POST -ContentType "application/json" `
    -Body '{"email":"test@example.com","password":"wrong"}' `
    -UseBasicParsing | Select-Object StatusCode
}

# 3. Check Redis keys
redis-cli KEYS "rl:*"

# 4. Check response headers
curl -v -X POST http://localhost:3000/client/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
```

## Notes

- **Fail-open policy**: Nếu Redis down, rate limiter cho phép request qua (log error). Đảm bảo service availability > rate limiting enforcement.
- **Defense-in-depth**: Auth endpoints được rate limit ở CẢ Gateway VÀ Auth-service. Gateway là tuyến phòng thủ chính, Auth-service là tuyến phụ.
- **Fixed-window algorithm**: Đơn giản, hiệu quả. Có thể upgrade lên sliding window nếu cần (v1.1).
- **Atomic Lua script**: Đảm bảo thread-safe trong môi trường multi-instance.
- **Email hashing**: Email được hash SHA-256 (16 chars) trước khi dùng làm key, không lưu email plaintext trong Redis.

---

## Hướng dẫn tích hợp Rate Limiter vào Service

### 1. Cấu trúc file trong `packages/common`

```
packages/common/src/rate-limiter/
├── index.ts                    # Barrel exports — re-export tất cả
├── rate-limiter.module.ts      # NestJS Dynamic Module (Global)
├── rate-limiter.service.ts     # Core service — giao tiếp Redis
├── rate-limiter.guard.ts       # NestJS Guard — chặn request khi vượt limit
├── rate-limiter.decorator.ts   # @RateLimit() decorator — gắn metadata lên route
├── rate-limiter.interfaces.ts  # TypeScript types & interfaces
└── rate-limiter.constants.ts   # Injection token + Lua script
```

Tất cả đã được export qua `packages/common/src/index.ts`:

```typescript
export * from './rate-limiter';
```

App import từ `@common/core`:

```typescript
import { RateLimiterModule, RateLimiterGuard, RateLimit, RateLimiterService } from '@common/core';
```

---

### 2. Đăng ký Module trong `app.module.ts`

**Bước 1: Import `RateLimiterModule.register()`**

```typescript
// app.module.ts của bất kỳ service nào (gateway, auth-service, notification-service, ...)
import {
  RateLimiterModule,
  RateLimiterGuard,
} from '@common/core';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // === Rate Limiter ===
    // Cách 1: Mặc định — đọc REDIS_URL từ ConfigService (env)
    RateLimiterModule.register(),

    // Cách 2: Truyền options tùy chỉnh
    // RateLimiterModule.register({
    //   redisUrl: 'redis://custom-host:6379',  // override Redis URL
    //   keyPrefix: 'myapp',                     // prefix cho tất cả key (default: 'rl')
    //   disabled: process.env.NODE_ENV === 'test', // tắt rate limit khi test
    // }),

    // ... các module khác
  ],
  providers: [
    // === Đăng ký RateLimiterGuard là Global Guard ===
    // Nghĩa là: TẤT CẢ route trong service đều đi qua guard này.
    // Nếu route KHÔNG có @RateLimit() decorator → guard bỏ qua (return true).
    // Nếu route CÓ @RateLimit() → guard kiểm tra Redis.
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule {}
```

**Lưu ý quan trọng:**

- `RateLimiterModule` là `@Global()` → chỉ cần import 1 lần ở root AppModule.
- `RateLimiterGuard` nên đặt là `APP_GUARD` để tự động áp dụng cho toàn bộ service.
- Nếu KHÔNG muốn global guard, có thể dùng `@UseGuards(RateLimiterGuard)` trên từng controller/method.
- Cần có env `REDIS_URL=redis://localhost:6379` trong `.env`.

---

### 3. RateLimiterModuleOptions — Tham số cấu hình

```typescript
interface RateLimiterModuleOptions {
  /**
   * Redis URL để kết nối.
   * Nếu không truyền → đọc từ ConfigService key 'REDIS_URL'.
   * Nếu ConfigService cũng không có → fallback 'redis://localhost:6379'.
   */
  redisUrl?: string;

  /**
   * Prefix toàn cục cho tất cả rate limit key trong Redis.
   * Default: 'rl'
   * Ví dụ: key cuối cùng = 'rl:login:ip:192.168.1.1'
   *
   * Dùng khi nhiều service chia sẻ cùng Redis instance
   * mà muốn tách biệt key namespace:
   *   - Gateway:      keyPrefix: 'gw'    → 'gw:login:ip:...'
   *   - Auth-service:  keyPrefix: 'auth'  → 'auth:login:ip:...'
   *
   * Mặc định cả 2 service dùng 'rl' → key chung → rate limit tính chung.
   * (Phù hợp nếu muốn defense-in-depth: vượt ở gateway thì auth cũng đếm)
   */
  keyPrefix?: string;

  /**
   * Tắt hoàn toàn rate limiting.
   * Dùng khi chạy test (NODE_ENV === 'test') hoặc dev cần tắt tạm.
   * Khi disabled = true → mọi request đều allowed, không gọi Redis.
   */
  disabled?: boolean;
}
```

---

### 4. `@RateLimit()` Decorator — Cách sử dụng

#### 4.1 Interface `RateLimitRule`

```typescript
type RateLimitKeySource = 'ip' | 'userId' | `body.${string}`;

interface RateLimitRule {
  /**
   * Prefix cho Redis key.
   * Quy tắc đặt tên: '{context}:{action}:{dimension}'
   *
   * Ví dụ:
   *   'login:ip'          → rl:login:ip:192.168.1.1
   *   'login:email'       → rl:login:email:a1b2c3d4...
   *   'api:notification'  → rl:api:notification:user-uuid
   *   'auth:forgot:email' → rl:auth:forgot:email:e5f6g7h8...
   *
   * Best practice:
   *   - Gateway dùng prefix KHÔNG có 'auth:' (vd: 'login:ip')
   *   - Auth-service dùng prefix CÓ 'auth:' (vd: 'auth:login:ip')
   *   - API endpoints dùng 'api:{resource}:{action}' (vd: 'api:notification:read')
   */
  prefix: string;

  /**
   * Số request tối đa cho phép trong window.
   *
   * Gợi ý limit theo loại endpoint:
   *   - Login:              5-10 / phút
   *   - Register:           3-5 / phút
   *   - Forgot password:    2-3 / 10 phút
   *   - Resend code:        2-3 / phút
   *   - Refresh token:      15-20 / phút
   *   - API read (GET):     60-120 / phút
   *   - API write (POST):   10-30 / phút
   */
  limit: number;

  /**
   * Thời gian cửa sổ tính bằng GIÂY (seconds).
   *
   * Ví dụ:
   *   60    → 1 phút
   *   300   → 5 phút
   *   600   → 10 phút
   *   3600  → 1 giờ
   */
  window: number;

  /**
   * Nguồn dữ liệu để tạo identifier cho rate limit key.
   *
   * 'ip'
   *   → Lấy IP từ: x-forwarded-for header → req.ip → req.socket.remoteAddress
   *   → Key: rl:{prefix}:{ip-address}
   *   → Dùng cho: public endpoints (login, register, forgot-password)
   *
   * 'userId'
   *   → Lấy từ: req.user.userId || req.user.sub || 'anonymous'
   *   → Key: rl:{prefix}:{user-uuid}
   *   → Dùng cho: authenticated endpoints (API calls, CRUD operations)
   *   → CHÚ Ý: cần có JwtAuthGuard chạy TRƯỚC RateLimiterGuard
   *     để req.user đã được populate.
   *
   * 'body.<field>'
   *   → Lấy giá trị req.body[field], hash SHA-256, cắt 16 chars
   *   → Key: rl:{prefix}:{sha256-hash-16chars}
   *   → Dùng cho: chống brute force theo email/username
   *   → Ví dụ: 'body.email' → req.body.email → hash → 'a1b2c3d4e5f6g7h8'
   *   → Email được lowercase + trim trước khi hash
   *   → Nếu field rỗng/null → identifier = 'empty'
   */
  keySource: RateLimitKeySource;

  /**
   * Custom error message khi bị rate limit (optional).
   * Default: 'Too many requests, please try again later'
   *
   * Ví dụ: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'
   */
  message?: string;
}
```

#### 4.2 Áp dụng lên route — Ví dụ chi tiết

**A) Một rule đơn giản — giới hạn theo IP:**

```typescript
import { Public, RateLimit } from '@common/core';

@Controller('auth')
export class AuthController {
  // Giới hạn: 5 request / 60 giây / mỗi IP
  // Redis key sẽ là: rl:register:ip:192.168.1.1
  @Post('register')
  @Public()
  @RateLimit({ prefix: 'register:ip', limit: 5, window: 60, keySource: 'ip' })
  async register(@Body() dto: RegisterDto) { ... }
}
```

**B) Nhiều rule — giới hạn theo IP VÀ email cùng lúc:**

```typescript
// Cả 2 rule đều phải pass. Nếu 1 trong 2 bị vượt → 429.
// Rule 1: Mỗi IP chỉ được thử login 10 lần / phút
// Rule 2: Mỗi email chỉ được thử login 5 lần / phút
// → Attacker dùng nhiều IP nhưng cùng email vẫn bị chặn.
@Post('login')
@Public()
@RateLimit([
  { prefix: 'login:ip', limit: 10, window: 60, keySource: 'ip' },
  { prefix: 'login:email', limit: 5, window: 60, keySource: 'body.email' },
])
async login(@Body() dto: LoginDto) { ... }
```

**C) Giới hạn theo userId — cho authenticated API:**

```typescript
// Yêu cầu: user đã đăng nhập (req.user đã có userId)
// Giới hạn: mỗi user chỉ được gọi 30 lần / phút
@Post(':id/read')
@RateLimit({ prefix: 'api:notification:read', limit: 30, window: 60, keySource: 'userId' })
async markRead(@Param('id') id: string) { ... }
```

**D) Controller-level — áp dụng cho TẤT CẢ route trong controller:**

```typescript
// Tất cả route trong controller đều bị giới hạn 60 req/phút/user.
// Nếu route con CÓ @RateLimit() riêng → override controller-level (KHÔNG cộng dồn).
@Controller('client/notification')
@RateLimit({ prefix: 'api:notification', limit: 60, window: 60, keySource: 'userId' })
export class NotificationController {
  // Route này KHÔNG có @RateLimit() riêng
  // → Dùng controller-level: 60/min per userId
  @Get()
  findAll() { ... }

  // Route này CÓ @RateLimit() riêng
  // → Override controller-level: chỉ áp dụng 10/min (KHÔNG phải 60/min)
  @Post('read-all')
  @RateLimit({ prefix: 'api:notification:read-all', limit: 10, window: 60, keySource: 'userId' })
  readAll() { ... }
}
```

**E) Custom error message:**

```typescript
@Post('login')
@RateLimit({
  prefix: 'login:ip',
  limit: 5,
  window: 60,
  keySource: 'ip',
  message: 'Too many login attempts. Please wait 1 minute before trying again.',
})
async login() { ... }
```

**F) Không có `@RateLimit()` → không bị rate limit:**

```typescript
// Route này KHÔNG có @RateLimit() decorator
// → RateLimiterGuard bỏ qua (return true) → không kiểm tra Redis
@Get('health')
@Public()
health() { return { status: 'ok' }; }
```

---

### 5. Cách Guard hoạt động — Flow chi tiết

```
Request đến
    │
    ▼
[RateLimiterGuard.canActivate()]
    │
    ├─ Đọc metadata @RateLimit() từ Reflector
    │   (kiểm tra handler trước, rồi class — getAllAndOverride)
    │
    ├─ Không có rules? → return true (cho qua)
    │
    ├─ Có rules → duyệt TỪNG rule:
    │     │
    │     ├─ buildKey(req, rule):
    │     │     keySource='ip'        → extractIp(req) → '192.168.1.1'
    │     │     keySource='userId'    → req.user.userId → 'uuid-xxx'
    │     │     keySource='body.email'→ sha256(req.body.email) → 'a1b2c3d4'
    │     │     → Final key: '{prefix}:{identifier}'
    │     │       Ví dụ: 'login:ip:192.168.1.1'
    │     │
    │     ├─ rateLimiterService.check(key, limit, window):
    │     │     → Redis EVAL Lua script:
    │     │        GET key → current count
    │     │        if current >= limit → BLOCKED (return [0, count, ttl])
    │     │        else → INCR key, PEXPIRE nếu mới tạo → ALLOWED (return [1, count, ttl])
    │     │     → Result: { allowed, count, remaining, retryAfterMs }
    │     │
    │     ├─ allowed = false?
    │     │     → Log warn: 'Rate limit exceeded' + { traceId, key, limit, window }
    │     │     → Set headers: X-RateLimit-Limit, X-RateLimit-Remaining=0, Retry-After
    │     │     → throw ServiceError(429, TOO_MANY_REQUESTS)
    │     │
    │     └─ allowed = true? → tiếp tục rule tiếp theo
    │
    ├─ Tất cả rules pass:
    │     → Set headers dựa trên rule có remaining THẤP NHẤT (mostRestrictive)
    │     → return true (cho request đi tiếp)
    │
    ▼
[Controller handler xử lý request]
```

---

### 6. Redis Key Format

```
┌─────────────────────────────────────────────────────────┐
│ rl : login:ip : 192.168.1.1                             │
│ ^^   ^^^^^^^^   ^^^^^^^^^^^^^                           │
│ │    │          │                                        │
│ │    │          └─ identifier (IP, userId, hoặc hash)   │
│ │    └─ prefix (từ @RateLimit decorator)                │
│ └─ keyPrefix (từ RateLimiterModule options, default 'rl')│
└─────────────────────────────────────────────────────────┘
```

**Key được tạo bởi:** `{moduleKeyPrefix}:{rulePrefix}:{identifier}`

Ví dụ với `keyPrefix = 'rl'`:

```
rl:login:ip:192.168.1.1                → 10 req / 60s   (IP-based)
rl:login:email:a1b2c3d4e5f6g7h8        → 5 req / 60s    (email hash)
rl:api:notification:550e8400-e29b-...   → 60 req / 60s   (userId)
rl:api:notification:read:550e8400-...   → 30 req / 60s   (userId)
```

---

### 7. Lua Script — Giải thích chi tiết

```lua
-- KEYS[1] = rate limit key (vd: 'rl:login:ip:192.168.1.1')
-- ARGV[1] = limit (vd: '10')
-- ARGV[2] = window in milliseconds (vd: '60000')

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

-- Bước 1: Đọc giá trị hiện tại của key
local current = tonumber(redis.call('GET', key) or '0')

-- Bước 2: Nếu đã vượt limit → từ chối
if current >= limit then
  local ttl = redis.call('PTTL', key)  -- Lấy thời gian còn lại (ms)
  if ttl < 0 then ttl = window end     -- Key hết hạn nhưng chưa xóa
  return {0, current, ttl}              -- {blocked, count, retry_after_ms}
end

-- Bước 3: Chưa vượt → tăng counter
local count = redis.call('INCR', key)

-- Bước 4: Nếu là lần đầu (count = 1) → set TTL cho key
if count == 1 then
  redis.call('PEXPIRE', key, window)   -- Key tự xóa sau window ms
end

-- Bước 5: Trả về {allowed, count, ttl_ms}
return {1, count, redis.call('PTTL', key)}
```

**Tại sao dùng Lua script?**
- **Atomic**: Toàn bộ GET + check + INCR + PEXPIRE chạy trong 1 lệnh Redis, không bị race condition.
- **Multi-instance safe**: Nhiều instance gateway cùng trỏ Redis → counter chính xác.

**Fixed-window algorithm:**
- Window bắt đầu từ request đầu tiên (khi INCR tạo key count=1).
- Sau `window` ms, key tự xóa → reset counter.
- Nhược điểm: Có thể burst ở ranh giới 2 window (vd: 10 req ở giây 59, 10 req ở giây 61).
- Chấp nhận được cho v1, upgrade lên sliding window ở v1.1 nếu cần.

---

### 8. Response Headers

Mỗi request đi qua RateLimiterGuard đều nhận headers:

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 10           ← Số request tối đa cho phép
X-RateLimit-Remaining: 7        ← Số request còn lại trong window
                                    (dựa trên rule có remaining thấp nhất)
```

Khi bị rate limit (429):

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
Retry-After: 45                  ← Số GIÂY cần đợi trước khi thử lại
Content-Type: application/json

{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  },
  "traceId": "abc-123-def-456"
}
```

---

### 9. Fail-open Policy

```
Redis online   → Rate limiter hoạt động bình thường
Redis offline  → Rate limiter CHO QUA tất cả request + log error
```

**Lý do:** Availability quan trọng hơn rate limiting. Nếu Redis down mà block request → toàn bộ service ngưng hoạt động.

Log khi Redis down:

```json
{
  "level": "error",
  "err": "Connection refused",
  "key": "rl:login:ip:192.168.1.1",
  "msg": "RateLimiter Redis error — failing open"
}
```

---

### 10. Sử dụng `RateLimiterService` trực tiếp (không qua Guard)

Ngoài cách dùng `@RateLimit()` decorator (tự động qua Guard), có thể inject `RateLimiterService` để kiểm tra/reset key thủ công:

```typescript
import { RateLimiterService } from '@common/core';

@Injectable()
export class MyService {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async doSomething(userId: string) {
    // Kiểm tra rate limit thủ công
    const result = await this.rateLimiter.check(
      `custom:action:${userId}`,  // key (sẽ thêm prefix 'rl:' phía trước)
      5,                           // limit: 5 requests
      60,                          // window: 60 seconds
    );

    if (!result.allowed) {
      throw new ServiceError({
        code: ErrorCodes.TOO_MANY_REQUESTS,
        statusCode: 429,
        message: `Rate limited. Retry after ${Math.ceil(result.retryAfterMs / 1000)}s`,
      });
    }

    // result.allowed = true → tiếp tục xử lý
    // result.count = số lần đã gọi trong window
    // result.remaining = số lần còn lại
    // result.retryAfterMs = thời gian chờ (ms) nếu bị chặn
  }

  async resetUserLimit(userId: string) {
    // Reset rate limit cho 1 user (admin action)
    await this.rateLimiter.reset(`custom:action:${userId}`);
  }
}
```

---

### 11. Thứ tự Guard quan trọng

Trong `app.module.ts`, thứ tự khai báo `APP_GUARD` quyết định thứ tự thực thi:

```typescript
providers: [
  // Guard 1: JWT Auth — chạy TRƯỚC
  // → Populate req.user (userId, email, permVersion)
  // → Nếu @Public() → bỏ qua
  { provide: APP_GUARD, useClass: JwtAuthGuard },

  // Guard 2: Rate Limiter — chạy SAU JWT
  // → Đã có req.user → keySource: 'userId' hoạt động đúng
  // → Nếu không có @RateLimit() → bỏ qua
  { provide: APP_GUARD, useClass: RateLimiterGuard },

  // Guard 3: Permission — chạy SAU cùng
  // → Kiểm tra quyền
  { provide: APP_GUARD, useClass: PermissionGuard },
]
```

**Quan trọng:** `JwtAuthGuard` phải chạy TRƯỚC `RateLimiterGuard` để `req.user` đã được set khi guard cần đọc `keySource: 'userId'`.

---

### 12. Tích hợp vào Service mới (Checklist)

Khi tạo service mới trong monorepo và muốn dùng rate limiting:

```
□ 1. Đảm bảo service đã có REDIS_URL trong .env
□ 2. Import RateLimiterModule.register() trong app.module.ts
□ 3. Đăng ký RateLimiterGuard làm APP_GUARD (SAU JwtAuthGuard)
□ 4. Thêm @RateLimit() decorator lên các route cần bảo vệ
□ 5. Rebuild packages/common nếu có thay đổi:
     cd packages/common && npm run build
□ 6. Test: gửi burst requests → verify 429 sau limit
□ 7. Kiểm tra Redis keys: redis-cli KEYS "rl:*"
□ 8. Kiểm tra response headers: X-RateLimit-Limit, X-RateLimit-Remaining
```

---

### 13. Debug & Troubleshooting

**Rate limit không hoạt động?**

```bash
# 1. Kiểm tra Redis có chạy không
redis-cli PING
# → PONG

# 2. Kiểm tra REDIS_URL trong .env
echo $REDIS_URL
# → redis://localhost:6379

# 3. Kiểm tra key có tạo trong Redis không
redis-cli KEYS "rl:*"
# → rl:login:ip:127.0.0.1
# → rl:login:email:a1b2c3d4e5f6g7h8

# 4. Kiểm tra TTL của key
redis-cli PTTL "rl:login:ip:127.0.0.1"
# → 45123 (ms còn lại)

# 5. Kiểm tra count hiện tại
redis-cli GET "rl:login:ip:127.0.0.1"
# → "3"

# 6. Reset rate limit cho 1 key
redis-cli DEL "rl:login:ip:127.0.0.1"

# 7. Xóa tất cả rate limit keys
redis-cli KEYS "rl:*" | xargs redis-cli DEL
```

**Rate limit quá chặt khi dev?**

```typescript
// Tắt rate limiting trong môi trường test/dev
RateLimiterModule.register({
  disabled: process.env.NODE_ENV === 'test',
})
```

**Nhiều instance cùng rate limit?**

Vì dùng Redis → tất cả instance chia sẻ cùng counter. Nếu limit = 10 và có 3 instance → tổng cộng vẫn chỉ 10 request/window (không phải 30).

---

### 14. Bảng tổng hợp tất cả Rate Limit Rules hiện tại

#### Gateway (`client/*`)

| Endpoint | Prefix | Limit | Window | KeySource | Mô tả |
|----------|--------|-------|--------|-----------|-------|
| `POST /client/auth/login` | `login:ip` | 10 | 60s | IP | Chống brute force per IP |
| `POST /client/auth/login` | `login:email` | 5 | 60s | body.email | Chống brute force per email |
| `POST /client/auth/register` | `register:ip` | 5 | 60s | IP | Chống spam đăng ký |
| `POST /client/auth/resend-code` | `resend:ip` | 5 | 60s | IP | Chống spam gửi lại code |
| `POST /client/auth/resend-code` | `resend:email` | 2 | 60s | body.email | Max 2 lần/phút/email |
| `POST /client/auth/refresh` | `refresh:ip` | 20 | 60s | IP | Refresh token |
| `POST /client/auth/forgot/password` | `forgot:ip` | 5 | 600s | IP | Chống spam forgot |
| `POST /client/auth/forgot/password` | `forgot:email` | 2 | 600s | body.email | Max 2 lần/10phút/email |
| `POST /client/auth/forgot/password/verify` | `forgot-verify:ip` | 10 | 600s | IP | Verify code |
| `POST /client/auth/forgot/password/reset` | `forgot-reset:ip` | 5 | 600s | IP | Reset password |
| `ALL /client/notification/*` | `api:notification` | 60 | 60s | userId | Tổng quát per user |
| `POST /client/notification` | `api:notification:create` | 10 | 60s | userId | Tạo notification |
| `POST /client/notification/:id/read` | `api:notification:read` | 30 | 60s | userId | Đánh dấu đọc |
| `POST /client/notification/read-all` | `api:notification:read-all` | 10 | 60s | userId | Đọc tất cả |
| `ALL /client/roles/*` | `api:roles` | 60 | 60s | userId | Tổng quát per user |
| `POST /client/roles` | `api:roles:create` | 10 | 60s | userId | Tạo role |
| `POST /client/roles/assign-role` | `api:roles:assign` | 10 | 60s | userId | Gán role |
| `POST /client/roles/unassign-role` | `api:roles:unassign` | 10 | 60s | userId | Bỏ role |

#### Auth-service (`auth/internal/*`) — Defense-in-depth

| Endpoint | Prefix | Limit | Window | KeySource | Mô tả |
|----------|--------|-------|--------|-----------|-------|
| `POST /auth/internal/register` | `auth:register:ip` | 5 | 60s | IP | Layer 2 |
| `POST /auth/internal/resend-code` | `auth:resend:ip` | 5 | 60s | IP | Layer 2 |
| `POST /auth/internal/resend-code` | `auth:resend:email` | 2 | 60s | body.email | Layer 2 |
| `POST /auth/internal/login` | `auth:login:ip` | 10 | 60s | IP | Layer 2 |
| `POST /auth/internal/login` | `auth:login:email` | 5 | 60s | body.email | Layer 2 |
| `POST /auth/internal/refresh` | `auth:refresh:ip` | 20 | 60s | IP | Layer 2 |
| `POST /auth/internal/forgot/password` | `auth:forgot:ip` | 5 | 600s | IP | Layer 2 |
| `POST /auth/internal/forgot/password` | `auth:forgot:email` | 2 | 600s | body.email | Layer 2 |
| `POST /auth/internal/forgot/password/verify` | `auth:forgot-verify:ip` | 10 | 600s | IP | Layer 2 |
| `POST /auth/internal/forgot/password/reset` | `auth:forgot-reset:ip` | 5 | 600s | IP | Layer 2 |
