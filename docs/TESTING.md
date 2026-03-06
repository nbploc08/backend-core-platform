# Testing

Tài liệu về chiến lược testing và cách chạy tests trong Backend Core Platform.

---

## Testing Strategy

| Layer    | Tool                | File Pattern           | Mục đích                              |
| -------- | ------------------- | ---------------------- | ------------------------------------- |
| **Unit** | Jest                | `*.spec.ts`            | Test từng service/controller riêng lẻ |
| **E2E**  | Jest + Supertest    | `*.e2e-spec.ts`        | Test HTTP endpoints end-to-end        |
| **Load** | Custom script (tsx) | `test/ws/load-test.ts` | Stress test WebSocket connections     |

---

## Running Tests

### Unit Tests

```bash
# Tất cả services
npm run test

# Từng service riêng
npm --workspace apps/auth-service run test
npm --workspace apps/gateway run test
npm --workspace apps/notification-service run test

# Watch mode
npm --workspace apps/auth-service run test:watch

# Coverage
npm --workspace apps/auth-service run test:cov
```

### E2E Tests

```bash
# Tất cả services
npm run test:e2e

# Từng service riêng
npm --workspace apps/auth-service run test:e2e
npm --workspace apps/gateway run test:e2e
npm --workspace apps/notification-service run test:e2e
```

> **Lưu ý:** E2E tests cần infrastructure (PostgreSQL, Redis, NATS) đang chạy.

### WebSocket Load Test

```bash
npm run test:ws-load
```

Hoặc chạy trực tiếp:

```bash
cd apps/gateway && npx tsx test/ws/load-test.ts
```

**Env variables (optional):**

| Variable           | Default                 | Mô tả                                  |
| ------------------ | ----------------------- | -------------------------------------- |
| `WS_URL`           | `http://localhost:3000` | WebSocket target URL                   |
| `JWT_SECRET`       | `change-me`             | Must match gateway's JWT_SECRET        |
| `JWT_ISSUER`       | `auth-service`          | JWT issuer                             |
| `JWT_AUDIENCE`     | `api`                   | JWT audience                           |
| `NUM_CLIENTS`      | `50`                    | Number of concurrent WS clients        |
| `RAMP_UP_DELAY_MS` | `50`                    | Delay between each client connect (ms) |

---

## Existing Test Files

### Unit Tests (`.spec.ts`)

| File                                                                                 | Service      | Scope                        |
| ------------------------------------------------------------------------------------ | ------------ | ---------------------------- |
| `apps/auth-service/src/modules/roles/roles.controller.spec.ts`                       | Auth         | RolesController methods      |
| `apps/auth-service/src/modules/roles/roles.service.spec.ts`                          | Auth         | RolesService logic           |
| `apps/gateway/src/app.controller.spec.ts`                                            | Gateway      | AppController (health, root) |
| `apps/gateway/src/modules/client/.../notification.controller.spec.ts`                | Gateway      | NotificationController       |
| `apps/notification-service/src/app.controller.spec.ts`                               | Notification | AppController                |
| `apps/notification-service/src/modules/notification/notification.controller.spec.ts` | Notification | NotificationController       |
| `apps/notification-service/src/modules/notification/notification.service.spec.ts`    | Notification | NotificationService          |
| `apps/notification-service/src/modules/jobs/jobs.controller.spec.ts`                 | Notification | JobsController               |
| `apps/notification-service/src/modules/jobs/jobs.service.spec.ts`                    | Notification | JobsService                  |

### E2E Tests (`.e2e-spec.ts`)

| File                                             | Service      | Scope                    |
| ------------------------------------------------ | ------------ | ------------------------ |
| `apps/gateway/test/app.e2e-spec.ts`              | Gateway      | `GET /` → "Hello World!" |
| `apps/auth-service/test/app.e2e-spec.ts`         | Auth         | `GET /` → "Hello World!" |
| `apps/notification-service/test/app.e2e-spec.ts` | Notification | `GET /` + `GET /health`  |

### Load Tests

| File                                | Scope                                 |
| ----------------------------------- | ------------------------------------- |
| `apps/gateway/test/ws/load-test.ts` | 6-phase WebSocket load test           |
| `apps/gateway/test/ws/helpers.ts`   | Load test utilities (config, metrics) |

---

## WebSocket Load Test Phases

Load test file `apps/gateway/test/ws/load-test.ts` chạy 6 phases:

| Phase | Tên                   | Mô tả                                                |
| ----- | --------------------- | ---------------------------------------------------- |
| 1     | **Connect**           | Ramp up N clients, mỗi client connect với JWT riêng  |
| 2     | **Ping/Pong**         | Measure round-trip latency cho tất cả clients        |
| 3     | **Notification Read** | Functional test: `notification:read` event handling  |
| 4     | **Rate Limit Stress** | Burst messages to test WS rate limiting (10 msg/sec) |
| 5     | **Multi-Tab**         | Simulate multiple connections per user               |
| 6     | **Disconnect**        | Gracefully disconnect all clients                    |

Metrics output: connection time, ping latency, success/failure counts, rate limit hits.

---

## CI/CD Integration

### GitHub Actions CI (`.github/workflows/ci.yml`)

CI pipeline chạy tự động trên mỗi push/PR:

```
Checkout → Setup Node.js → Start NATS → Create DB schemas
→ npm ci → Build packages → Lint → Prisma migrate
→ Unit tests → E2E tests → Build apps → Stop NATS
```

**Test infrastructure trong CI:**

| Service       | Image                | Port |
| ------------- | -------------------- | ---- |
| PostgreSQL 16 | `postgres:16`        | 5432 |
| Redis 7       | `redis:7-alpine`     | 6379 |
| NATS 2.10     | `nats:2.10` (docker) | 4222 |

**Matrix builds:** Node.js 20.x và 22.x

**Lint-only PR check** (`.github/workflows/lint.yml`):
Chỉ chạy lint, không cần DB/Redis/NATS — nhanh hơn CI full.

---

## Writing Tests

### Unit Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyService } from './my.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MyService', () => {
  let service: MyService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Mocking Guidelines

| Dependency           | Mock Strategy                                                       |
| -------------------- | ------------------------------------------------------------------- |
| `PrismaService`      | `useValue` với jest.fn() cho từng model method                      |
| `NatsService`        | `useValue: { publish: jest.fn() }`                                  |
| `ConfigService`      | `useValue: { get: jest.fn().mockReturnValue('...') }`               |
| `RateLimiterService` | `useValue: { check: jest.fn().mockResolvedValue({allowed: true}) }` |
| External HTTP        | `jest.mock('axios')` hoặc `useValue: { post: jest.fn() }`           |

### Test Configuration

Mỗi service có `jest-e2e.json` trong `test/`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

---

## Test Database Setup

Cho E2E tests cần database thực:

1. Start infrastructure: `docker compose -f infra/docker-compose.dev.yml up -d`
2. Run migrations:
   ```bash
   cd apps/auth-service && DATABASE_URL="..." npx prisma migrate deploy
   cd apps/notification-service && DATABASE_URL="..." npx prisma migrate deploy
   cd apps/gateway && DATABASE_URL="..." npx prisma migrate deploy
   ```
3. Seed data (optional): `cd apps/auth-service && npx prisma db seed`

Trong CI, database setup được tự động hóa trong workflow steps.
