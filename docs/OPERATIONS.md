# Operations

Tài liệu vận hành Backend Core Platform — logging, error handling, health checks, job queues, database migrations.

---

## 1. Structured Logging (Pino)

### Configuration

- **Library:** Pino (high-performance JSON logger)
- **Format:** JSON structured logging (machine-parseable)
- **Location:** `packages/common/src/logging/logger.ts`

### Log Levels

| Level   | Khi nào dùng                                            |
| ------- | ------------------------------------------------------- |
| `fatal` | Ứng dụng không thể tiếp tục (process crash)             |
| `error` | Lỗi cần xử lý (DB connection fail, unhandled exception) |
| `warn`  | Cảnh báo (rate limit hit, deprecation, retry)           |
| `info`  | Sự kiện quan trọng (request completed, user logged in)  |
| `debug` | Chi tiết debug (SQL queries, cache operations)          |
| `trace` | Rất chi tiết (function entry/exit)                      |

Cấu hình qua env var:

```bash
LOG_LEVEL=info   # production
LOG_LEVEL=debug  # development
```

### Request ID / Trace ID

- **Middleware:** `RequestIdMiddleware` (Gateway)
- Mỗi request được gán UUID unique → header `x-request-id`
- ID được propagate xuống backend services qua header `x-request-id`
- Tất cả log entries chứa `requestId` để trace xuyên suốt

### HTTP Logger Interceptor

`HttpLoggerInterceptor` tự động log mỗi request/response:

```json
{
  "level": "info",
  "msg": "HTTP GET /health 200 5ms",
  "requestId": "abc-123-def",
  "method": "GET",
  "url": "/health",
  "statusCode": 200,
  "responseTime": 5
}
```

### Sensitive Data Redaction

Pino tự động redact các fields nhạy cảm:

- `authorization` — không log Authorization header
- `cookie` — không log cookies
- `password` — không log passwords
- `token` — không log JWT tokens

---

## 2. Error Handling

### ServiceError

Custom error class dùng chung cho tất cả services:

```typescript
import { ServiceError, ErrorCodes } from '@common/core';

throw new ServiceError({
  code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
  statusCode: 401,
  message: 'Invalid email or password',
  exposeMessage: true, // optional: cho phép client thấy message
});
```

### Error Codes

Định nghĩa trong `packages/common/src/errors/error-codes.ts`:

| Code                       | HTTP Status | Mô tả                    |
| -------------------------- | ----------- | ------------------------ |
| `AUTH_INVALID_CREDENTIALS` | 401         | Wrong email/password     |
| `AUTH_TOKEN_EXPIRED`       | 401         | JWT expired              |
| `AUTH_TOKEN_INVALID`       | 401         | Invalid JWT              |
| `FORBIDDEN`                | 403         | Insufficient permissions |
| `NOT_FOUND`                | 404         | Resource not found       |
| `CONFLICT`                 | 409         | Duplicate resource       |
| `TOO_MANY_REQUESTS`        | 429         | Rate limit exceeded      |
| `INTERNAL`                 | 500         | Unexpected server error  |
| `UPSTREAM_FAILURE`         | 502         | Backend service error    |
| `UPSTREAM_TIMEOUT`         | 504         | Backend service timeout  |

### HttpExceptionFilter

Global filter format tất cả errors thành response chuẩn:

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "traceId": "abc-123-def-456"
}
```

**Production behavior:**

- Không leak stack traces
- Validation errors trả `details` array
- Unknown errors → generic `INTERNAL` code

### Axios Error Handling

`handleAxiosError()` utility để xử lý lỗi từ backend services:

- Timeout → `UPSTREAM_TIMEOUT`
- Connection refused → `UPSTREAM_FAILURE`
- HTTP error from upstream → forward error code

---

## 3. Health Checks

### Endpoints

| Service      | URL                                | Auth   |
| ------------ | ---------------------------------- | ------ |
| Gateway      | `GET /health`                      | Public |
| Gateway      | `GET /`                            | Public |
| Notification | `GET /client/notification/healthz` | Public |

### Verify Health

```bash
# Gateway
curl http://localhost:3000/health

# NATS monitoring
curl http://localhost:8222/jsz
curl http://localhost:8222/healthz

# PostgreSQL
docker exec core_postgres pg_isready -U core -d coredb

# Redis
docker exec core_redis redis-cli ping
```

---

## 4. Job Queue (BullMQ)

### Architecture

```
Auth Service                    Notification Service
    │                                │
    │ QueueService.add()             │
    │ (mail queue producer)          │
    │───────────────────────────────▶│ JobsService (BullMQ worker)
    │                                │ process job
    │                                │ → MailsService.send()
    │                                │
    │                                │ Failed? → Retry (3 attempts)
    │                                │ → Exponential backoff
    │                                │ → DLQ (mail-dlq)
```

### Queues

| Queue      | Producer     | Consumer             | Mô tả                     |
| ---------- | ------------ | -------------------- | ------------------------- |
| `mail`     | Auth Service | Notification Service | Email sending jobs        |
| `mail-dlq` | BullMQ auto  | Manual review        | Failed jobs after retries |

### Job Types

| Job Name                  | Trigger         | Action                    |
| ------------------------- | --------------- | ------------------------- |
| `send-verify-code`        | User registered | Send verification email   |
| `passwordReset.requested` | Forgot password | Send password reset email |

### Retry Strategy

- **Max retries:** 3
- **Backoff:** Exponential
- **DLQ:** Jobs that fail after all retries are moved to `mail-dlq`

### Email Templates

Notification Service dùng Handlebars templates cho emails:

- Verification email (OTP code)
- Password reset email (reset link)

Gmail SMTP configuration:

```env
MAIL_USER=your-email@gmail.com
MAIL_APP_PASSWORD=your-app-password
```

---

## 5. Database

### Prisma ORM

Mỗi service có Prisma schema riêng:

| Service      | Schema File                                      | DB Schema      |
| ------------ | ------------------------------------------------ | -------------- |
| Auth         | `apps/auth-service/prisma/schema.prisma`         | `auth`         |
| Notification | `apps/notification-service/prisma/schema.prisma` | `notification` |
| Gateway      | `apps/gateway/prisma/schema.prisma`              | `gateway`      |

### Migrations

**Development** (tạo migration mới):

```bash
cd apps/auth-service
npx prisma migrate dev --name add_new_field
```

**Production** (apply existing migrations):

```bash
cd apps/auth-service
npx prisma migrate deploy
```

**Generate client** (sau khi sửa schema):

```bash
npm run prisma:generate
```

### Database URL Format

```
postgresql://user:password@host:port/database?schema=schema_name
```

Ví dụ:

```bash
# Auth
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=auth"

# Notification
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=notification"

# Gateway
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=gateway"
```

### Seed Data

```bash
cd apps/auth-service && npx prisma db seed
```

Chạy files trong `apps/auth-service/prisma/seed/`:

- `role.seed.ts` — tạo permissions (`notifications:read`, `notifications:write`) và roles (`user`, `admin`)
- `user.seed.ts` — tạo users (`admin@example.com`, `user@example.com`) với roles

---

## 6. NATS JetStream

### Streams

| Stream               | Subjects         | Persistence |
| -------------------- | ---------------- | ----------- |
| `AUTH_EVENT`         | `user.*`         | JetStream   |
| `NOTIFICATION_EVENT` | `notification.*` | JetStream   |

### Consumers

| Consumer                       | Stream               | Filter                 | Service              |
| ------------------------------ | -------------------- | ---------------------- | -------------------- |
| `notification-user-registered` | `AUTH_EVENT`         | `user.registered`      | Notification Service |
| `gateway-notification-created` | `NOTIFICATION_EVENT` | `notification.created` | Gateway              |

### Monitoring

```bash
# JetStream info
curl http://localhost:8222/jsz

# Stream details
curl http://localhost:8222/jsz?streams=true

# Consumer details
curl http://localhost:8222/jsz?consumers=true
```

---

## 7. Redis

### Usage

| Feature          | Key Pattern                  | TTL               |
| ---------------- | ---------------------------- | ----------------- |
| Rate Limiting    | `rl:{prefix}:{identifier}`   | Auto (Lua script) |
| Permission Cache | `permissions:user:{userId}:` | Until invalidated |
| BullMQ Jobs      | `bull:mail:*`                | Auto (BullMQ)     |

### Monitoring

```bash
# Connect to Redis CLI
docker exec -it core_redis redis-cli

# Check rate limit keys
KEYS rl:*

# Check permission cache
KEYS permissions:*

# Check BullMQ jobs
KEYS bull:*

# Memory usage
INFO memory
```

---

## 8. Infrastructure (Docker)

### Development Environment

```bash
# Start all services
docker compose -f infra/docker-compose.dev.yml up -d

# Stop all services
docker compose -f infra/docker-compose.dev.yml down

# View logs
docker compose -f infra/docker-compose.dev.yml logs -f

# Reset (remove volumes)
docker compose -f infra/docker-compose.dev.yml down -v
```

### Containers

| Container       | Image            | Ports       | Volume               |
| --------------- | ---------------- | ----------- | -------------------- |
| `core_postgres` | `postgres:16`    | 5433 → 5432 | `core_postgres_data` |
| `core_nats`     | `nats:2.10`      | 4222, 8222  | —                    |
| `core_redis`    | `redis:7-alpine` | 6379        | `core_redis_data`    |

---

## 9. Performance Considerations

### Rate Limiting

- Redis Lua script ensures atomic operations (no race conditions)
- Fail-open strategy: if Redis is down, requests are allowed
- Per-route configuration via `@RateLimit()` decorator

### Permission Caching

- Redis cache avoids repeated DB queries for permissions
- `permVersion` comparison ensures cache consistency
- Cache invalidation on role/permission changes

### Connection Pooling

- Prisma manages database connection pool automatically
- Redis connections managed by `ioredis` with `maxRetriesPerRequest: 3`

### WebSocket

- Socket Registry: in-memory Map for O(1) user → socket lookups
- In-memory rate limiting: no Redis overhead for WS messages
- Multi-tab support: one user can have multiple socket connections

---

## 10. Common Operations

### Restart a service

```bash
# Ctrl+C to stop, then:
npm run dev:gateway
```

### Check service logs

Services log to stdout in JSON format. Use `pino-pretty` for human-readable output:

```bash
npm run dev:gateway | npx pino-pretty
```

### Clear Redis cache

```bash
docker exec -it core_redis redis-cli FLUSHALL
```

### Check NATS streams

```bash
curl -s http://localhost:8222/jsz | jq .
```

### Reset database

```bash
docker compose -f infra/docker-compose.dev.yml down -v
docker compose -f infra/docker-compose.dev.yml up -d
# Wait for Postgres to be ready, then re-run migrations and seed
```
