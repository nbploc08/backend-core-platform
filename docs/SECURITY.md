# Security

Tài liệu bảo mật cho Backend Core Platform — mô tả các cơ chế bảo mật đã triển khai trong code.

---

## 1. Authentication

### JWT Access Tokens

- **Algorithm:** HS256 (HMAC-SHA256)
- **TTL:** Configurable via `JWT_EXPIRES_IN` (default `9000s` ≈ 2.5 giờ)
- **Issuer:** `auth-service` (via `JWT_ISSUER`)
- **Audience:** `api` (via `JWT_AUDIENCE`)
- **Claims:** `{ sub: userId, email, permVersion, iat, exp }`

Token được sign bởi Auth Service và verify bởi Gateway (sử dụng Passport.js `JwtStrategy`).

### Refresh Tokens

- **Lưu trữ:** Hash (SHA-256) trong database, **KHÔNG** lưu plain text
- **Per-device tracking:** Mỗi refresh token gắn `deviceId`, `deviceName`, `ipAddress`, `userAgent`
- **Rotation:** Mỗi lần refresh, token cũ bị revoke và token mới được cấp
- **Revocation:** Hỗ trợ:
  - `logout-device` — revoke 1 session
  - `logout-all` — revoke tất cả sessions của user
- **Delivery:** HTTP-only secure cookie (`httpOnly: true, secure: true, sameSite: 'strict'`)

### Password Hashing

- **Algorithm:** Argon2id (OWASP recommended)
- **Parameters:**
  - `memoryCost: 65536` (64 MB)
  - `timeCost: 3` (3 iterations)
  - `parallelism: 4`
- **Implementation:** `packages/common/src/security/password.util.ts`
- **Functions:** `hashPassword()`, `verifyPassword()`

### Encryption

- **Algorithm:** AES-256-GCM with scrypt key derivation
- **Key:** 32-byte `ENCRYPT_KEY` từ environment variable
- **Sử dụng:** Mã hóa OTP codes trước khi gửi qua NATS events
- **Implementation:** `packages/common/src/security/crypto.util.ts`
- **Functions:** `encrypt()`, `decrypt()`, `getEncryptKey()`

---

## 2. Authorization (RBAC)

Chi tiết xem [RBAC.md](RBAC.md).

### Overview

- **Model:** Role-Based Access Control (RBAC) chuẩn
- **Entities:** User → UserRole → Role → RolePermission → Permission
- **Guard:** `PermissionGuard` (global `APP_GUARD` trên Gateway và Auth Service)
- **Decorator:** `@RequirePermission('permission:code')` trên controller/handler
- **Permission versioning:** `permVersion` trong User model, tăng khi quyền thay đổi

### Permission Cache (Redis)

- **Key format:** `permissions:user:{userId}:`
- **Storage:** Redis hash với `permVersion` và `permissions` (JSON array)
- **Flow:**
  1. Request → `PermissionGuard` check Redis cache
  2. Cache hit + `permVersion` khớp → dùng cached permissions
  3. Cache miss hoặc `permVersion` lệch → fetch từ Auth Service → update cache
- **Invalidation:** Khi role/permission thay đổi → invalidate cache

### Token Type Guard

- **`@UserOnly()`** — Chỉ cho phép User JWT (chặn Internal JWT)
- **`@InternalOnly()`** — Chỉ cho phép Internal JWT (chặn User JWT)
- **Implementation:** `TokenTypeGuard` sử dụng `TOKEN_TYPE_KEY` metadata

---

## 3. Internal JWT (Service-to-Service)

### Zero-Trust Architecture

Các service backend không tin tưởng nhau by default. Mọi request giữa services phải có Internal JWT.

| Property | Value                                           |
| -------- | ----------------------------------------------- |
| Secret   | `INTERNAL_JWT_SECRET` (riêng biệt với User JWT) |
| Issuer   | `gateway` (hoặc service name)                   |
| Audience | `internal`                                      |
| TTL      | 5 phút                                          |

### Combined JWT Guard

Auth Service và Notification Service dùng `CombinedJwtGuard`:

- Decode JWT → kiểm tra `audience`
- `audience === 'api'` → verify bằng `JWT_SECRET` (User JWT)
- `audience === 'internal'` → verify bằng `INTERNAL_JWT_SECRET` (Internal JWT)

### Request Flow

```
Gateway signs Internal JWT
    → axios request with headers:
        Authorization: Bearer <internal-jwt>
        x-request-id: <uuid>
        x-user-jwt: <original-user-jwt>   (forward user context)
    → Backend service verifies Internal JWT
    → PermissionGuard skips permission check for internal tokens (trusted)
```

---

## 4. Rate Limiting

### HTTP Rate Limiting (Redis-based)

- **Implementation:** `packages/common/src/rate-limiter/`
- **Algorithm:** Fixed-window counter via atomic Lua script
- **Storage:** Redis (`INCR` + `PEXPIRE` trong single Lua eval)
- **Fail-open:** Nếu Redis down → cho phép request (log error)

#### Lua Script

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  local ttl = redis.call('PTTL', key)
  if ttl < 0 then ttl = window end
  return {0, current, ttl}
end

local count = redis.call('INCR', key)
if count == 1 then
  redis.call('PEXPIRE', key, window)
end

return {1, count, redis.call('PTTL', key)}
```

#### Guard Architecture

```
Request → RateLimiterGuard (APP_GUARD)
    → Reflector reads @RateLimit() metadata
    → No rules? → pass through
    → For each rule:
        → buildKey(req, rule) → rl:{prefix}:{identifier}
        → RateLimiterService.check(key, limit, window)
        → If !allowed → 429 ServiceError
    → Set response headers (most restrictive rule)
```

#### Key Sources

| `keySource`      | Giải thích                                        |
| ---------------- | ------------------------------------------------- |
| `'ip'`           | IP từ `x-forwarded-for` hoặc `req.ip`             |
| `'userId'`       | `req.user.userId` hoặc `req.user.sub`             |
| `'body.<field>'` | SHA-256 hash của `req.body[field]` (ví dụ: email) |

#### Rate Limit Rules (Thực tế trong code)

**Gateway — Auth endpoints:**

| Endpoint                                   | Rules                                    |
| ------------------------------------------ | ---------------------------------------- |
| `POST /client/auth/login`                  | 10/min per IP, 5/min per `body.email`    |
| `POST /client/auth/register`               | 5/min per IP                             |
| `POST /client/auth/resend-code`            | 5/min per IP, 2/min per `body.email`     |
| `POST /client/auth/refresh`                | 20/min per IP                            |
| `POST /client/auth/forgot/password`        | 5/10min per IP, 2/10min per `body.email` |
| `POST /client/auth/forgot/password/verify` | 10/10min per IP                          |
| `POST /client/auth/forgot/password/reset`  | 5/10min per IP                           |

**Gateway — Notification endpoints:**

| Endpoint                             | Rules             |
| ------------------------------------ | ----------------- |
| Controller-level (all)               | 60/min per userId |
| `POST /client/notification` (create) | 10/min per userId |
| `POST /client/notification/:id/read` | 30/min per userId |
| `POST /client/notification/read-all` | 10/min per userId |

**Gateway — Role endpoints:**

| Endpoint                           | Rules             |
| ---------------------------------- | ----------------- |
| Controller-level (all)             | 60/min per userId |
| `POST /client/roles`               | 10/min per userId |
| `POST /client/roles/assign-role`   | 10/min per userId |
| `POST /client/roles/unassign-role` | 10/min per userId |

**Auth Service — Defense-in-depth:**

Auth Service cũng có rate limiting riêng (bảo vệ khi có ai gọi trực tiếp, bypass Gateway):

| Endpoint                                     | Rules                                    |
| -------------------------------------------- | ---------------------------------------- |
| `POST /auth/internal/login`                  | 10/min per IP, 5/min per `body.email`    |
| `POST /auth/internal/register`               | 5/min per IP                             |
| `POST /auth/internal/resend-code`            | 5/min per IP, 2/min per `body.email`     |
| `POST /auth/internal/refresh`                | 20/min per IP                            |
| `POST /auth/internal/forgot/password`        | 5/10min per IP, 2/10min per `body.email` |
| `POST /auth/internal/forgot/password/verify` | 10/10min per IP                          |
| `POST /auth/internal/forgot/password/reset`  | 5/10min per IP                           |

#### Response Headers

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
Retry-After: 45           # chỉ khi bị 429
```

#### Error Response (429)

```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later"
  },
  "traceId": "abc-123"
}
```

### WebSocket Rate Limiting (In-memory)

- **Limit:** 10 messages/second/user
- **Algorithm:** Fixed-window counter (in-memory Map)
- **Scope:** Per user (tất cả tabs chung 1 limit)
- **Reset:** Mỗi giây reset counter
- **Applied to:** `notification:read`, `notification:read-all` handlers

---

## 5. CORS Configuration

### Hiện trạng

- **HTTP endpoints (Gateway, Auth, Notification):** Không có explicit CORS configuration — dùng NestJS default
- **WebSocket:** `origin: '*', credentials: true`

> **⚠️ Lưu ý:** WebSocket CORS hiện đang dùng wildcard. Trong production nên cấu hình allowlist.

---

## 6. Input Validation

### Auth Service

- `ValidationPipe` global với options:
  - `whitelist: true` — strip unknown properties
  - `forbidNonWhitelisted: true` — throw error on unknown properties
  - `transform: true` — auto-transform payloads to DTO instances

### Contracts (Zod)

- NATS events và WebSocket payloads validate bằng Zod schemas
- Nếu payload không match schema → reject message

---

## 7. Error Handling

### ServiceError

```typescript
throw new ServiceError({
  code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
  statusCode: 401,
  message: 'Invalid email or password',
});
```

### HttpExceptionFilter

- Format tất cả errors thành response chuẩn:
  ```json
  {
    "error": {
      "code": "AUTH_INVALID_CREDENTIALS",
      "message": "Invalid email or password"
    },
    "traceId": "abc-123"
  }
  ```
- **Production:** Không leak stack traces
- **Development:** Có thể include extra details

---

## 8. Logging & Secret Protection

### Pino Logger

- **Format:** JSON structured logging
- **Request ID:** UUID per request (via `RequestIdMiddleware`)
- **Redaction:** Tự động redact sensitive fields:
  - `authorization`
  - `cookie`
  - `password`
  - `token`

### No Secrets in Code

- Tất cả secrets lấy từ environment variables
- `.env` files trong `.gitignore`
- `.env.example` chỉ chứa placeholders

---

## 9. Idempotency

- **Scope:** POST `/client/auth/register` endpoint
- **Mechanism:**
  1. Client gửi `Idempotency-Key` header
  2. Gateway compute SHA-256 hash từ method + path + body
  3. Check DB (`IdempotencyRecord`) → processing/completed/failed status
  4. Same key + same hash → return cached response
  5. Same key + different hash → 409 Conflict
  6. No `Idempotency-Key` → execute normally (no idempotency)
- **Cache:** In-memory cache (5 min TTL) + database persistence
- **Status flow:** `processing` → `completed` | `failed`

---

## 10. SQL Injection Prevention

- **Prisma ORM:** Tất cả queries đều parameterized
- Không có raw SQL queries trong codebase
- Input validation trước khi truyền vào Prisma

---

## Security Checklist

| Category               | Status | Implementation                               |
| ---------------------- | ------ | -------------------------------------------- |
| Password hashing       | ✅     | Argon2id (65536 memory, 3 iterations)        |
| JWT authentication     | ✅     | RS256, short-lived access + rotating refresh |
| Refresh token security | ✅     | Hashed in DB, per-device, HTTP-only cookie   |
| RBAC authorization     | ✅     | PermissionGuard + @RequirePermission()       |
| Permission versioning  | ✅     | permVersion in JWT, instant revocation       |
| Internal JWT           | ✅     | Separate secret, 5min TTL, zero-trust        |
| HTTP rate limiting     | ✅     | Redis Lua script, per IP/email/userId        |
| WS rate limiting       | ✅     | In-memory, 10 msg/sec/user                   |
| Input validation       | ✅     | ValidationPipe + Zod schemas                 |
| SQL injection          | ✅     | Prisma ORM (parameterized queries)           |
| Error handling         | ✅     | ServiceError, no stack traces in prod        |
| Logging                | ✅     | Pino JSON, secret redaction                  |
| Idempotency            | ✅     | SHA-256 hash, DB + memory cache              |
| Encryption             | ✅     | AES-256-GCM for OTP codes                    |
| CI/CD                  | ✅     | GitHub Actions with matrix builds            |
| Security headers       | ⚠️     | Chưa có Helmet middleware                    |
| CORS allowlist         | ⚠️     | WS dùng `origin: '*'`                        |
