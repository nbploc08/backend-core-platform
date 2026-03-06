# Architecture

Tài liệu kiến trúc hệ thống Backend Core Platform — monorepo NestJS microservices.

---

## System Overview

```
                        ┌──────────────┐
                        │    Client    │
                        │  (Browser)   │
                        └──────┬───────┘
                               │
                    HTTP / WebSocket (Socket.IO)
                               │
                ┌──────────────▼──────────────┐
                │      Gateway (Port 3000)     │
                │                              │
                │  • JwtAuthGuard (User JWT)   │
                │  • RateLimiterGuard (Redis)  │
                │  • PermissionGuard (RBAC)    │
                │  • RequestIdMiddleware       │
                │  • IdempotencyService        │
                │  • WebSocket Gateway         │
                │  • HTTP Proxy (axios)        │
                └───┬──────────────────┬───────┘
                    │                  │
           Internal JWT          Internal JWT
            + axios               + axios
                    │                  │
      ┌─────────────▼──────┐  ┌───────▼──────────────────┐
      │ Auth Service (3001) │  │ Notification Service (3002)│
      │                     │  │                            │
      │ • CombinedJwtGuard  │  │ • CombinedJwtGuard        │
      │ • RateLimiterGuard  │  │ • PermissionGuard          │
      │ • PermissionGuard   │  │ • JetStream Consumer       │
      │ • TokenTypeGuard    │  │ • BullMQ Worker            │
      │ • LocalStrategy     │  │ • MailsService             │
      │ • UsersService      │  │ • NotificationService      │
      │ • RolesService      │  │                            │
      │ • QueueService      │  │                            │
      └──────┬──────────────┘  └───────┬────────────────────┘
             │                         │
             │    ┌────────────────┐    │
             ├────┤  PostgreSQL 16 ├────┤
             │    │ (auth/notif/gw │    │
             │    │   schemas)     │    │
             │    └────────────────┘    │
             │                         │
             │    ┌────────────────┐    │
             ├────┤    Redis 7     ├────┤
             │    │ (rate limit +  │    │
             │    │  perm cache)   │    │
             │    └────────────────┘    │
             │                         │
             │    ┌────────────────┐    │
             └────┤ NATS 2.10 (JS)├────┘
                  │ (event bus)    │
                  └────────────────┘
```

---

## Services

### Gateway (Port 3000)

**Vai trò:** API Gateway / BFF (Backend-for-Frontend). Entry point duy nhất cho client.

**Responsibilities:**

- HTTP proxy tới Auth Service và Notification Service (qua axios + Internal JWT)
- WebSocket server (Socket.IO) cho realtime notifications
- JWT authentication (User JWT verification via Passport.js)
- Global rate limiting (Redis-based `RateLimiterGuard`)
- Permission checking (`PermissionGuard`, fetch permissions từ Auth Service, cache Redis)
- Idempotency framework cho POST endpoints
- Request ID generation (`RequestIdMiddleware`)
- NATS JetStream consumer: `notification.created` → push WebSocket event

**Key Modules:**
| Module | Mô tả |
| ------------------- | ----------------------------------------- |
| `AuthClientModule` | Proxy auth endpoints tới Auth Service |
| `RoleClientModule` | Proxy role endpoints tới Auth Service |
| `NotificationModule`| Proxy notification endpoints + WS events |
| `WebsocketModule` | Core WS gateway + socket registry |
| `PrismaModule` | Database (IdempotencyRecord) |
| `RateLimiterModule` | Redis rate limiting |
| `PermissionModule` | RBAC permission checking |
| `NatsModule` | NATS JetStream (NOTIFICATION_EVENT stream) |

### Auth Service (Port 3001)

**Vai trò:** Identity & Access Management. Quản lý users, authentication, authorization.

**Responsibilities:**

- User registration + email verification (OTP)
- Login (email/password, Argon2id)
- JWT access token signing + refresh token management
- Refresh token rotation, per-device tracking, session revocation
- Forgot/reset password flow
- RBAC management (roles, permissions, user-role assignment)
- NATS JetStream publish: `user.registered`
- BullMQ: push email jobs (`send-verify-code`, `passwordReset.requested`)

**Key Modules:**
| Module | Mô tả |
| --------------- | ----------------------------------- |
| `AuthModule` | Register, login, verify, forgot pwd |
| `UsersModule` | User CRUD, refresh tokens |
| `RolesModule` | RBAC CRUD, assign/unassign roles |
| `QueueModule` | BullMQ producer (mail queue) |
| `JwtModule` | JWT signing/verification |
| `PrismaModule` | Database (auth schema) |
| `RateLimiterModule` | Defense-in-depth rate limiting |
| `PermissionModule` | Permission checking |

### Notification Service (Port 3002)

**Vai trò:** Notification & Email management. Xử lý sự kiện từ NATS, gửi email, quản lý in-app notifications.

**Responsibilities:**

- JetStream consumer: `user.registered` → tạo welcome notification + gửi verification email
- BullMQ worker: xử lý email jobs (`send-verify-code`, `passwordReset.requested`)
- Email sending via Nodemailer (Gmail SMTP) with Handlebars templates
- CRUD cho in-app notifications (list, unread count, mark read)
- NATS JetStream publish: `notification.created`
- Dead Letter Queue (DLQ) cho failed email jobs

**Key Modules:**
| Module | Mô tả |
| ------------------- | --------------------------------------------- |
| `NotificationModule`| Notification CRUD |
| `MailsModule` | Email sending (Nodemailer + Handlebars) |
| `JetstreamModule` | NATS JetStream consumer |
| `JobsModule` | BullMQ worker cho email jobs |
| `JwtModule` | JWT verification (combined user + internal) |
| `PrismaModule` | Database (notification schema) |

---

## Shared Packages

### `@common/core` (`packages/common`)

Utilities, guards, decorators dùng chung cho tất cả services.

| Module / Export | Mô tả                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `logging/`      | Pino logger, `HttpLoggerInterceptor`, request ID                                                                          |
| `errors/`       | `HttpExceptionFilter`, `ServiceError`, `ErrorCodes`, `handleAxiosError`                                                   |
| `security/`     | `hashPassword`, `verifyPassword` (Argon2id), `encrypt`, `decrypt` (AES-256-GCM)                                           |
| `decorators/`   | `@Public()`, `@User()`, `@Info()`, `@Cookies()`, `@RequirePermission()`, `@RateLimit()`, `@UserOnly()`, `@InternalOnly()` |
| `permission/`   | `PermissionGuard`, `PermissionProvider`, `PermissionCache`, `TokenTypeGuard`, `PermissionCode` enum                       |
| `nats/`         | `NatsService`, `NatsModule.forRoot()`, `BaseJetstreamConsumer`                                                            |
| `rate-limiter/` | `RateLimiterService`, `RateLimiterGuard`, `RateLimiterModule.register()`, Lua script                                      |

### `@contracts/core` (`packages/contracts`)

Contract-first event schemas và WebSocket payload definitions (Zod-validated).

| Category  | Exports                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `events/` | `USER_REGISTERED` + `UserRegisteredSchema`, `NOTIFICATION_CREATED` + `NotificationCreatedSchema`                                              |
| `jobs/`   | `PASSWORD_RESET_REQUESTED` + `PasswordResetRequestedSchema`                                                                                   |
| `ws/`     | `WS_NOTIFICATION_NEW`, `WS_NOTIFICATION_READ`, `WS_NOTIFICATION_READ_ALL`, `WS_NOTIFICATION_UPDATED`, `WS_UNREAD_COUNT_UPDATED` + Zod schemas |

---

## Database Schemas

Ba services dùng chung 1 PostgreSQL instance với schemas riêng biệt:

### Auth Schema (`auth`)

```
┌────────────────┐     ┌───────────────┐     ┌──────────────────┐
│     users      │     │     roles     │     │   permissions    │
├────────────────┤     ├───────────────┤     ├──────────────────┤
│ id (UUID, PK)  │     │ id (UUID, PK) │     │ id (UUID, PK)   │
│ email (unique) │     │ name (unique) │     │ code (unique)    │
│ passwordHash   │     │ description   │     │ description      │
│ permVersion    │     │ createdAt     │     │ createdAt        │
│ name           │     │ updatedAt     │     │ updatedAt        │
│ phone          │     └───────┬───────┘     └──────┬───────────┘
│ age            │             │                    │
│ address        │     ┌───────▼───────────────────▼┐
│ isActive       │     │    role_permissions        │
│ createdAt      │     ├────────────────────────────┤
│ updatedAt      │     │ roleId (FK → roles)        │
└───────┬────────┘     │ permissionId (FK → perms)  │
        │              │ (composite PK)             │
        │              └────────────────────────────┘
┌───────▼────────┐
│  user_roles    │
├────────────────┤
│ userId (FK)    │
│ roleId (FK)    │
│ assignedAt     │
│ (composite PK) │
└────────────────┘

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   emailOtps    │     │ refreshTokens  │     │ passwordResets  │
├────────────────┤     ├────────────────┤     ├────────────────┤
│ id (UUID, PK)  │     │ id (UUID, PK)  │     │ id (UUID, PK)  │
│ userId (unique)│     │ userId (FK)    │     │ userId (FK)    │
│ codeHash       │     │ tokenHash(uniq)│     │ tokenHash      │
│ expiresAt      │     │ deviceId       │     │ expiresAt      │
│ isUsed         │     │ deviceName     │     │ used           │
│ createdAt      │     │ ipAddress      │     │ createdAt      │
│ updatedAt      │     │ userAgent      │     └────────────────┘
└────────────────┘     │ revokedAt      │
                       │ expiresAt      │
                       │ createdAt      │
                       └────────────────┘
```

### Notification Schema (`notification`)

```
┌─────────────────────┐
│    notifications    │
├─────────────────────┤
│ id (UUID, PK)       │
│ userId (String)     │
│ type (String)       │
│ title (String)      │
│ body (String)       │
│ data (JSON, opt)    │
│ readAt (DateTime?)  │
│ createdAt           │
└─────────────────────┘
```

### Gateway Schema (`gateway`)

```
┌──────────────────────────┐
│   idempotency_records    │
├──────────────────────────┤
│ id (UUID, PK)            │
│ key (String, unique)     │
│ requestHash (String)     │
│ status (String)          │
│   processing|completed|failed
│ responseStatus (Int?)    │
│ responseBody (JSON?)     │
│ expiresAt (DateTime)     │
│ createdAt                │
│ updatedAt                │
└──────────────────────────┘
```

---

## Data Flows

### User Registration → Email Verification

```
Client                Gateway              Auth Service         Notification Service
  │                      │                      │                      │
  │ POST /register       │                      │                      │
  │ + Idempotency-Key    │                      │                      │
  │─────────────────────▶│  proxy (axios +      │                      │
  │                      │  Internal JWT)       │                      │
  │                      │─────────────────────▶│                      │
  │                      │                      │ create User          │
  │                      │                      │ hash password        │
  │                      │                      │ generate OTP         │
  │                      │                      │                      │
  │                      │                      │ NATS publish         │
  │                      │                      │ user.registered      │
  │                      │                      │─────────────────────▶│
  │                      │                      │                      │ JetStream consume
  │                      │                      │                      │ user.registered
  │                      │                      │                      │
  │                      │                      │ BullMQ push          │ Create welcome
  │                      │                      │ send-verify-code     │ notification
  │                      │                      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│
  │                      │                      │                      │ BullMQ process
  │                      │                      │                      │ → send email
  │                      │  201 Created         │                      │
  │◀─────────────────────│◀─────────────────────│                      │
  │                      │                      │                      │
```

### Login → JWT Issuance

```
Client                Gateway              Auth Service
  │                      │                      │
  │ POST /login          │                      │
  │ {email, password}    │                      │
  │─────────────────────▶│  proxy + Internal JWT│
  │                      │─────────────────────▶│
  │                      │                      │ LocalStrategy
  │                      │                      │ validate(email, pwd)
  │                      │                      │ Argon2 verify
  │                      │                      │ Sign access token
  │                      │                      │ (sub, permVersion)
  │                      │                      │ Generate refresh
  │                      │                      │ token (hashed in DB)
  │                      │  200 + tokens        │
  │◀─────────────────────│◀─────────────────────│
  │  Set-Cookie:         │                      │
  │  refreshToken=...    │                      │
```

### Notification Creation → WebSocket Push

```
Any Service            Notification Service       NATS          Gateway          Client (WS)
  │                          │                      │              │                │
  │ Create notification      │                      │              │                │
  │─────────────────────────▶│                      │              │                │
  │                          │ save to DB            │              │                │
  │                          │ count unread          │              │                │
  │                          │                      │              │                │
  │                          │ NATS publish          │              │                │
  │                          │ notification.created  │              │                │
  │                          │─────────────────────▶│              │                │
  │                          │                      │ JS deliver   │                │
  │                          │                      │─────────────▶│                │
  │                          │                      │              │ emitToUser()   │
  │                          │                      │              │ notification:  │
  │                          │                      │              │ new            │
  │                          │                      │              │───────────────▶│
  │                          │                      │              │                │ Display
```

---

## Event-Driven Architecture

### NATS JetStream Streams

| Stream               | Subjects         | Consumers                                             |
| -------------------- | ---------------- | ----------------------------------------------------- |
| `AUTH_EVENT`         | `user.*`         | `notification-user-registered` (notification-service) |
| `NOTIFICATION_EVENT` | `notification.*` | `gateway-notification-created` (gateway)              |

### Events

| Event Subject          | Publisher            | Consumer             | Payload (Zod)                                                                       |
| ---------------------- | -------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `user.registered`      | Auth Service         | Notification Service | `{ userId, email, code, createdAt }`                                                |
| `notification.created` | Notification Service | Gateway              | `{ notificationId, userId, type, title, body, data, unreadCount, actionCreatedAt }` |

### BullMQ Job Queues

| Queue      | Job Name                  | Producer     | Consumer             | Retries | Backoff       |
| ---------- | ------------------------- | ------------ | -------------------- | ------- | ------------- |
| `mail`     | `send-verify-code`        | Auth Service | Notification Service | 3       | Exponential   |
| `mail`     | `passwordReset.requested` | Auth Service | Notification Service | 3       | Exponential   |
| `mail-dlq` | (failed jobs)             | —            | —                    | —       | Manual review |

---

## Communication Patterns

### Gateway → Backend Services (HTTP Proxy)

Gateway acts as reverse proxy, forwarding requests to backend services:

```
Client request → Gateway → axios.post(AUTH_SERVICE_URL + path, body, {
  headers: {
    Authorization: `Bearer ${internalJwt}`,   // Internal JWT (5min TTL)
    'x-request-id': requestId,                // Trace ID propagation
    'x-user-jwt': originalUserJwt,            // Forward user context
  }
}) → Auth/Notification Service
```

### Internal JWT

- **Purpose:** Zero-trust service-to-service authentication
- **Separate secret:** `INTERNAL_JWT_SECRET` (different from user JWT)
- **TTL:** 5 minutes
- **Audience:** `internal`
- Auth Service uses `CombinedJwtGuard` to detect `audience` and pick correct secret

### Permission Flow

```
Request → Gateway JWT Guard → PermissionGuard
  → Check Redis cache (key: permissions:user:{userId})
  → Cache hit + permVersion match → use cached
  → Cache miss → fetch from Auth Service → cache in Redis
  → Check @RequirePermission('code') → allow or 403
```

---

## Technology Decisions

| Decision                      | Rationale                                                          |
| ----------------------------- | ------------------------------------------------------------------ |
| **Monorepo (npm workspaces)** | Single repo, shared packages, but services deploy independently    |
| **NATS JetStream**            | Lightweight, built-in persistence, at-least-once delivery          |
| **BullMQ**                    | Redis-backed job queue with retry, backoff, DLQ support            |
| **Prisma**                    | Type-safe ORM, auto-generated client, migration management         |
| **Socket.IO**                 | WebSocket with fallback, rooms, namespace support                  |
| **Argon2id**                  | OWASP-recommended password hashing (memory-hard)                   |
| **Lua script rate limiting**  | Atomic Redis operations, no race conditions                        |
| **Contract-first (Zod)**      | Runtime validation of events/WS payloads, compile-time type safety |
| **Pino**                      | Fast JSON structured logging, redaction support                    |
