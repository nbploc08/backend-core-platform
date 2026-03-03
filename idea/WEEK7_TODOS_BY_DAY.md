# Week 7 — TODO List theo từng ngày

**Status:** ❌ Chưa bắt đầu (0% hoàn thành)  
**Estimated effort:** 5-7 ngày làm việc

---

## Day 43 — Advanced Rate Limiting (Redis-based)

### ❌ Chưa làm (Priority: 🔴 CRITICAL)

#### Setup
- [ ] Cài đặt `ioredis` vào `package.json` (hiện chỉ import chưa declare)
  ```bash
  npm install ioredis
  npm install --save-dev @types/ioredis
  ```

#### Implementation
- [ ] Tạo `packages/common/src/rate-limiter/` module:
  - [ ] `rate-limiter.module.ts` — Dynamic module với Redis config
  - [ ] `rate-limiter.service.ts` — Redis INCR+EXPIRE hoặc Lua script
  - [ ] `rate-limiter.guard.ts` — NestJS guard để check rate limit
  - [ ] `rate-limiter.decorator.ts` — `@RateLimit({ key, window, max })` decorator
  - [ ] `rate-limiter.constants.ts` — Constants & interfaces

#### Rate Limit Rules (cần implement)
- [ ] **Login by IP:** `rl:login:ip:<ip>` — 5 requests / 1 minute
- [ ] **Login by Email:** `rl:login:email:<hash>` — 3 requests / 1 minute
- [ ] **Forgot Password:** `rl:forgot:email:<hash>` — 2 requests / 10 minutes
- [ ] **API calls:** `rl:api:<userId>:<action>` — 100 requests / 1 minute

#### Apply to Endpoints
- [ ] Auth-service:
  - [ ] `POST /auth/login` — rate limit by IP + email
  - [ ] `POST /auth/register` — rate limit by IP (optional)
  - [ ] `POST /auth/forgot-password` — rate limit by email
- [ ] Gateway:
  - [ ] Forward rate limit headers to client
  - [ ] Log rate limit hits với traceId

#### Error Handling
- [ ] Return **429 Too Many Requests** với generic message:
  ```json
  {
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests, please try again later"
    },
    "traceId": "xxx"
  }
  ```
- [ ] Log internally: `{ level: 'warn', msg: 'Rate limit hit', key: 'rl:login:ip:x.x.x.x', userId?, traceId }`

#### Testing
- [ ] Unit test `RateLimiterService`:
  - [ ] First N requests pass
  - [ ] (N+1)th request fails with 429
  - [ ] After TTL expired, requests pass again
- [ ] E2E test (manual with curl):
  ```bash
  for i in {1..10}; do
    curl -X POST http://localhost:3000/client/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com","password":"wrong"}'
  done
  # Should see 429 after 5 attempts
  ```

#### Environment Variables
- [ ] Thêm vào `.env.example`:
  ```
  # Rate Limiting
  RATE_LIMIT_LOGIN_IP_WINDOW=60000        # milliseconds (1 min)
  RATE_LIMIT_LOGIN_IP_MAX=5
  RATE_LIMIT_LOGIN_EMAIL_WINDOW=60000
  RATE_LIMIT_LOGIN_EMAIL_MAX=3
  RATE_LIMIT_FORGOT_PASSWORD_WINDOW=600000 # 10 minutes
  RATE_LIMIT_FORGOT_PASSWORD_MAX=2
  RATE_LIMIT_API_WINDOW=60000
  RATE_LIMIT_API_MAX=100
  ```

**Estimated Time:** 1.5 - 2 days

---

## Day 44 — Helmet + CORS Allowlist

### ❌ Chưa làm (Priority: 🔴 CRITICAL)

#### Helmet (Security Headers)
- [ ] Cài đặt `helmet`:
  ```bash
  npm install helmet
  npm install --save-dev @types/helmet
  ```
- [ ] Cấu hình Helmet trong `apps/gateway/src/main.ts`:
  ```typescript
  import helmet from 'helmet';
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  }));
  ```
- [ ] Cấu hình Helmet trong `apps/auth-service/src/main.ts` (tương tự)
- [ ] Cấu hình Helmet trong `apps/notification-service/src/main.ts` (tương tự)

#### CORS Allowlist
- [ ] Thêm env var `CORS_ORIGINS`:
  ```
  # .env.example
  CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
  ```
- [ ] Cấu hình CORS trong `apps/gateway/src/main.ts`:
  ```typescript
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
  ```
- [ ] Cấu hình CORS cho WebSocket trong `apps/gateway/src/modules/websocket/websocket.gateway.ts`:
  ```typescript
  export const WS_GATEWAY_OPTIONS = {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  };
  ```
  ⚠️ **FIX:** Hiện đang là `origin: '*'` → INSECURE!

- [ ] Cấu hình CORS trong `apps/auth-service/src/main.ts` (tương tự)
- [ ] Cấu hình CORS trong `apps/notification-service/src/main.ts` (tương tự)

#### Testing
- [ ] Test security headers:
  ```bash
  curl -I http://localhost:3000
  # Should see:
  # X-Content-Type-Options: nosniff
  # X-Frame-Options: DENY
  # X-XSS-Protection: 1; mode=block
  # Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  # Content-Security-Policy: ...
  ```
- [ ] Test CORS:
  ```bash
  curl -X OPTIONS http://localhost:3000/client/auth/login \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -v
  # Should see Access-Control-Allow-Origin: http://localhost:3000
  
  curl -X OPTIONS http://localhost:3000/client/auth/login \
    -H "Origin: http://evil.com" \
    -H "Access-Control-Request-Method: POST" \
    -v
  # Should NOT see Access-Control-Allow-Origin (blocked)
  ```

**Estimated Time:** 0.5 - 1 day

---

## Day 45 — E2E Tests Full Flows

### ❌ Chưa làm (Priority: 🟡 HIGH)

#### Setup Test Environment
- [ ] Tạo `infra/docker-compose.test.yml`:
  ```yaml
  version: '3.8'
  services:
    postgres-test:
      image: postgres:16
      environment:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: test
      ports:
        - "5433:5432"
    
    redis-test:
      image: redis:7
      ports:
        - "6380:6379"
    
    nats-test:
      image: nats:latest
      command: ["-js"]
      ports:
        - "4223:4222"
  ```

- [ ] Script `scripts/setup-test-db.sh`:
  ```bash
  #!/bin/bash
  export DATABASE_URL_AUTH="postgresql://test:test@localhost:5433/test?schema=auth"
  export DATABASE_URL_NOTIFICATION="postgresql://test:test@localhost:5433/test?schema=notification"
  export DATABASE_URL_GATEWAY="postgresql://test:test@localhost:5433/test?schema=gateway"
  
  cd apps/auth-service && npx prisma migrate deploy
  cd ../notification-service && npx prisma migrate deploy
  cd ../gateway && npx prisma migrate deploy
  ```

- [ ] Test fixtures trong `apps/gateway/test/fixtures/`:
  - [ ] `users.fixture.ts` — Test users (admin, user, no-permission user)
  - [ ] `roles.fixture.ts` — Test roles & permissions
  - [ ] `notifications.fixture.ts` — Test notifications

#### E2E Test Suites

##### 1. Auth Flow (`apps/gateway/test/auth.e2e-spec.ts`)
- [ ] **Register flow:**
  - [ ] POST `/client/auth/register` → 201 + user created
  - [ ] Duplicate email → 409 Conflict
  - [ ] Invalid email format → 400 Validation error
- [ ] **Login flow:**
  - [ ] POST `/client/auth/login` → 200 + access + refresh token
  - [ ] Wrong password → 401 Invalid credentials
  - [ ] Non-existent user → 401 Invalid credentials
- [ ] **Refresh flow:**
  - [ ] POST `/client/auth/refresh` với valid refresh → 200 + new tokens
  - [ ] Invalid refresh token → 401
  - [ ] Revoked refresh token → 401
- [ ] **Logout flow:**
  - [ ] POST `/client/auth/logout` → 200
  - [ ] Refresh token invalidated after logout
- [ ] **Logout all flow:**
  - [ ] POST `/client/auth/logout-all` → 200
  - [ ] All sessions revoked

##### 2. RBAC Flow (`apps/gateway/test/rbac.e2e-spec.ts`)
- [ ] **Permission check:**
  - [ ] User without permission → 403 Forbidden
  - [ ] User with permission → 200 OK
- [ ] **Assign role:**
  - [ ] POST `/client/users/:id/roles` → 201
  - [ ] User gains permissions from role
- [ ] **Permission version:**
  - [ ] Change role → permVersion++
  - [ ] Old JWT (with old permVersion) → 401 Permission changed
  - [ ] New JWT (with new permVersion) → 200 OK
- [ ] **Permission cache:**
  - [ ] First request → DB lookup + cache
  - [ ] Second request → cache hit (faster)
  - [ ] Role change → cache invalidated

##### 3. Notification Flow (`apps/gateway/test/notifications.e2e-spec.ts`)
- [ ] **Welcome notification:**
  - [ ] Register user → welcome notification created
  - [ ] `GET /client/notification/list` → includes welcome noti
- [ ] **List notifications:**
  - [ ] `GET /client/notification/list` → 200 + paginated results
  - [ ] `page=1&limit=10` → first 10 notifications
  - [ ] `page=2&limit=10` → next 10 notifications
  - [ ] `sortBy=createdAt&sortOrder=desc` → newest first
- [ ] **Unread count:**
  - [ ] `GET /client/notification/unread-count` → correct count
  - [ ] After mark read → count decreases
- [ ] **Mark read:**
  - [ ] `POST /client/notification/:id/read` → 200
  - [ ] Notification readAt updated
  - [ ] Unread count decreases
- [ ] **Read all:**
  - [ ] `POST /client/notification/read-all` → 200
  - [ ] All notifications marked read
  - [ ] Unread count = 0

##### 4. WebSocket Flow (`apps/gateway/test/websocket.e2e-spec.ts`)
- [ ] **Connect with JWT:**
  - [ ] Connect với valid JWT → authenticated event
  - [ ] Connect without JWT → error event
  - [ ] Connect với invalid JWT → error event
- [ ] **Receive notification:new:**
  - [ ] Create notification → WS emits `notification:new`
  - [ ] Payload includes notificationId, title, body, unreadCount
- [ ] **Send notification:read:**
  - [ ] Client sends `notification:read` → notification marked read
  - [ ] All tabs receive `notification:updated` event
- [ ] **Send notification:read-all:**
  - [ ] Client sends `notification:read-all` → all marked read
  - [ ] All tabs receive `notification:updated` with unreadCount=0
- [ ] **Multi-tab sync:**
  - [ ] Connect 3 clients with same user
  - [ ] Action in tab A → tabs B & C receive updates
- [ ] **Ping/Pong:**
  - [ ] Send `ping` → receive `pong` with timestamp

##### 5. Idempotency Flow (`apps/gateway/test/idempotency.e2e-spec.ts`)
- [ ] **Same key + same payload:**
  - [ ] First request → 201 + user created
  - [ ] Second request (same key) → 200 + same response (no duplicate)
- [ ] **Same key + different payload:**
  - [ ] First request → 201
  - [ ] Second request (same key, different email) → 409 Conflict
- [ ] **No idempotency key:**
  - [ ] Two requests without key → 2 users created (different IDs)
- [ ] **Expired idempotency record:**
  - [ ] After TTL (5 minutes) → key can be reused

##### 6. Rate Limit Flow (`apps/gateway/test/rate-limit.e2e-spec.ts`)
- [ ] **Login rate limit by IP:**
  - [ ] First 5 requests → 401 (wrong password)
  - [ ] 6th request → 429 Rate limit exceeded
  - [ ] Wait 1 minute → rate limit reset
- [ ] **Login rate limit by email:**
  - [ ] 3 requests for same email → 3rd passes
  - [ ] 4th request → 429
- [ ] **Forgot password rate limit:**
  - [ ] 2 requests → OK
  - [ ] 3rd request → 429
  - [ ] Wait 10 minutes → reset
- [ ] **API rate limit per user:**
  - [ ] 100 requests → pass
  - [ ] 101st request → 429

#### npm Scripts
- [ ] Thêm vào `package.json`:
  ```json
  {
    "scripts": {
      "test:e2e": "jest --config ./test/jest-e2e.json",
      "test:e2e:watch": "jest --config ./test/jest-e2e.json --watch",
      "test:e2e:cov": "jest --config ./test/jest-e2e.json --coverage"
    }
  }
  ```

**Estimated Time:** 2-3 days

---

## Day 46 — CI GitHub Actions

### ❌ Chưa làm (Priority: 🟡 HIGH)

#### GitHub Actions Workflow
- [ ] Tạo `.github/workflows/ci.yml`:
  - [ ] Trigger: push to main/develop, pull requests
  - [ ] Matrix: Node 18.x, 20.x
  - [ ] Services: Postgres, Redis, NATS
  - [ ] Steps:
    - [ ] Checkout code
    - [ ] Setup Node.js
    - [ ] Install dependencies (`npm ci`)
    - [ ] Lint (`npm run lint`)
    - [ ] Run migrations (Prisma migrate deploy)
    - [ ] Unit tests (`npm run test`)
    - [ ] E2E tests (`npm run test:e2e`)
    - [ ] Build (`npm run build`)
    - [ ] Upload coverage (optional)

- [ ] Tạo `.github/workflows/lint.yml`:
  - [ ] Trigger: pull requests only
  - [ ] Fast check: lint only (no tests)

#### Test CI Locally
- [ ] Install `act` (GitHub Actions local runner):
  ```bash
  # Windows (Chocolatey)
  choco install act
  
  # Test workflow locally
  act -j lint-and-test
  ```

#### Verify CI
- [ ] Push to branch → trigger CI
- [ ] Create PR → verify CI runs
- [ ] Fix any CI failures
- [ ] All checks pass ✅

#### Badges
- [ ] Thêm badges vào `README.md`:
  ```markdown
  ![CI](https://github.com/yourusername/backend-core-platform/workflows/CI/badge.svg)
  ![Lint](https://github.com/yourusername/backend-core-platform/workflows/Lint/badge.svg)
  ```

**Estimated Time:** 0.5 - 1 day

---

## Day 47-49 — Refactor + Documentation

### ⚠️ Một phần (Priority: 🟢 MEDIUM - HIGH)

#### Root README.md (CRITICAL)
- [ ] Tạo `README.md` tại root với:
  - [ ] Project overview
  - [ ] Features list
  - [ ] Quick start (5 steps)
  - [ ] Architecture diagram
  - [ ] Links to docs/
  - [ ] Badges (CI, Lint, License)

#### docs/SETUP.md
- [ ] Prerequisites (Node 18+, Docker, npm)
- [ ] Clone repo
- [ ] Install dependencies (`npm install`)
- [ ] Start infrastructure (`docker-compose up`)
- [ ] Run migrations (Prisma)
- [ ] Start services (`npm run dev:gateway`, `dev:auth`, `dev:notification`)
- [ ] Environment variables setup
- [ ] Troubleshooting section

#### docs/ARCHITECTURE.md
- [ ] System overview diagram (draw.io or mermaid)
- [ ] Service descriptions:
  - [ ] Gateway (port 3000) — BFF, WebSocket, request routing
  - [ ] Auth-service (port 3001) — Auth + RBAC
  - [ ] Notification-service (port 3002) — Notifications + email
- [ ] Technology stack:
  - [ ] NestJS, TypeScript, Prisma, PostgreSQL
  - [ ] NATS JetStream, Redis, BullMQ
  - [ ] Socket.IO, Nodemailer, Argon2
- [ ] Data flow diagrams:
  - [ ] User registration → email verification
  - [ ] Login → JWT issuance
  - [ ] Notification creation → WebSocket push
- [ ] Database schemas (ERD)
- [ ] Event-driven architecture (NATS events)

#### docs/SECURITY.md (CRITICAL)
- [ ] **Authentication:**
  - [ ] JWT access tokens (15 min expiry)
  - [ ] Refresh tokens (hashed in DB)
  - [ ] Refresh token rotation
  - [ ] Session revocation
- [ ] **Authorization:**
  - [ ] RBAC (Roles, Permissions, UserRoles)
  - [ ] `@RequirePermission()` decorator
  - [ ] Permission version tracking
  - [ ] Permission caching (Redis)
- [ ] **Internal JWT:**
  - [ ] Zero-trust service-to-service auth
  - [ ] Internal JWT verification
- [ ] **Rate Limiting:**
  - [ ] Redis-based rate limiter
  - [ ] Login endpoints (per IP, per email)
  - [ ] API endpoints (per user)
  - [ ] Configurable limits via env vars
- [ ] **Security Headers:**
  - [ ] Helmet.js configuration
  - [ ] CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] **CORS:**
  - [ ] Allowlist configuration (no wildcards)
  - [ ] Credentials support
- [ ] **Password Security:**
  - [ ] Argon2id hashing
  - [ ] Password policy (min length, complexity)
- [ ] **SQL Injection:**
  - [ ] Prisma ORM (parameterized queries)
- [ ] **Error Handling:**
  - [ ] ServiceError codes
  - [ ] No stack traces in production
  - [ ] Sanitized error messages
- [ ] **Secret Management:**
  - [ ] Environment variables
  - [ ] No secrets in code/commits
  - [ ] `.env.example` with placeholders

#### docs/RBAC.md
- [ ] Move `idea/RBAC_OVERVIEW_AND_HOW_TO_ADD_PERMISSION.md` → `docs/RBAC.md`
- [ ] Clean up formatting
- [ ] Add code examples:
  - [ ] Assigning roles to users (API call)
  - [ ] Creating new permissions (seed script)
  - [ ] Using `@RequirePermission()` in controllers
  - [ ] Permission version flow

#### docs/TESTING.md
- [ ] **Testing Strategy:**
  - [ ] Unit tests (Jest, `.spec.ts` files)
  - [ ] E2E tests (Supertest, `.e2e-spec.ts` files)
  - [ ] Load tests (WebSocket, `test/ws/load-test.ts`)
- [ ] **Running Tests:**
  - [ ] `npm run test` — unit tests
  - [ ] `npm run test:e2e` — E2E tests
  - [ ] `npm run test:ws-load` — WebSocket load test
  - [ ] `npm run test:cov` — coverage report
- [ ] **Writing Tests:**
  - [ ] Test fixtures (users, roles, notifications)
  - [ ] Database setup/teardown (`beforeAll`, `afterAll`)
  - [ ] Mocking external services (NATS, Redis, email)
  - [ ] Test naming conventions
- [ ] **CI/CD Integration:**
  - [ ] GitHub Actions runs tests on push/PR
  - [ ] Test database setup in CI
  - [ ] Coverage reporting (optional)

#### docs/OPERATIONS.md
- [ ] **Monitoring & Logging:**
  - [ ] Structured logging (Pino, JSON format)
  - [ ] Request ID / Trace ID propagation
  - [ ] Log levels (debug, info, warn, error)
  - [ ] Log aggregation (optional: ELK, Grafana Loki)
- [ ] **Error Handling:**
  - [ ] ServiceError error codes
  - [ ] Error sanitization (no leaks)
  - [ ] 4xx vs 5xx errors
  - [ ] Tracing errors across services
- [ ] **Health Checks:**
  - [ ] `GET /health` endpoints
  - [ ] Database connectivity check
  - [ ] NATS connectivity check
  - [ ] Redis connectivity check
- [ ] **Job Queue Management:**
  - [ ] BullMQ dashboard (Bull Board - optional)
  - [ ] Failed job handling
  - [ ] DLQ (Dead Letter Queue)
  - [ ] Retry strategies
- [ ] **Database Migrations:**
  - [ ] Development: `npx prisma migrate dev`
  - [ ] Production: `npx prisma migrate deploy`
  - [ ] Rollback strategies
- [ ] **Performance:**
  - [ ] Rate limiting (prevent abuse)
  - [ ] Caching (Redis for permissions)
  - [ ] Connection pooling (Prisma)
  - [ ] Load testing results

#### docs/API.md (Optional, nice to have)
- [ ] Option 1: Manual API documentation (Markdown tables)
- [ ] Option 2: Swagger/OpenAPI integration:
  - [ ] Install `@nestjs/swagger`
  - [ ] Annotate controllers:
    - [ ] `@ApiTags('Auth')` on controller
    - [ ] `@ApiOperation({ summary: 'Login user' })` on methods
    - [ ] `@ApiResponse({ status: 200, description: 'Success' })`
  - [ ] Serve Swagger UI at `/api-docs`
  - [ ] Generate OpenAPI spec (`swagger-spec.json`)

#### Update .env.example files
- [ ] `apps/gateway/.env.example`
- [ ] `apps/auth-service/.env.example`
- [ ] `apps/notification-service/.env.example`
- [ ] Thêm các env vars mới:
  ```
  # Rate Limiting
  RATE_LIMIT_LOGIN_IP_WINDOW=60000
  RATE_LIMIT_LOGIN_IP_MAX=5
  RATE_LIMIT_LOGIN_EMAIL_WINDOW=60000
  RATE_LIMIT_LOGIN_EMAIL_MAX=3
  RATE_LIMIT_FORGOT_PASSWORD_WINDOW=600000
  RATE_LIMIT_FORGOT_PASSWORD_MAX=2
  RATE_LIMIT_API_WINDOW=60000
  RATE_LIMIT_API_MAX=100
  
  # CORS
  CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
  
  # Security
  HELMET_ENABLED=true
  ```

#### Code Refactoring (Optional)
- [ ] Remove console.log (use logger)
- [ ] Fix linter warnings (`npm run lint`)
- [ ] Remove unused imports
- [ ] Add JSDoc comments to complex functions
- [ ] Extract magic numbers to constants

**Estimated Time:** 2-3 days

---

## 📊 Summary

| Day | Feature | Status | Est. Time | Priority |
|-----|---------|--------|-----------|----------|
| **43** | Redis Rate Limiting | ❌ Not Started | 1.5-2 days | 🔴 CRITICAL |
| **44** | Helmet + CORS | ❌ Not Started | 0.5-1 day | 🔴 CRITICAL |
| **45** | E2E Tests | ❌ Not Started | 2-3 days | 🟡 HIGH |
| **46** | CI/CD (GitHub Actions) | ❌ Not Started | 0.5-1 day | 🟡 HIGH |
| **47-49** | Documentation | ⚠️ Partial | 2-3 days | 🟢 MEDIUM-HIGH |

**Total Estimated Time:** 5-7 days

---

## 🚨 Production Blockers (Must Fix)

1. ❌ **No HTTP rate limiting** → Brute force vulnerable
2. ❌ **CORS wildcard** (`origin: '*'`) → CSRF vulnerable
3. ❌ **No security headers** → Missing CSP, HSTS, etc.
4. ⚠️ **ioredis not in package.json** → Runtime error risk

---

## ✅ Recommended Execution Order

### Phase 1: Security (CRITICAL) — Days 43-44
**Must do first** — Production blockers

1. Day 43: Rate Limiting (1.5-2 days)
2. Day 44: Helmet + CORS (0.5-1 day)

### Phase 2: Testing — Day 45
**Should do** — Ensure quality before deployment

3. Day 45: E2E Tests (2-3 days)

### Phase 3: Automation — Day 46
**Should do** — CI/CD pipeline

4. Day 46: GitHub Actions (0.5-1 day)

### Phase 4: Documentation — Days 47-49
**Nice to have** — Can be done in parallel or after Week 8

5. Days 47-49: Docs (2-3 days)
   - Priority: SECURITY.md, SETUP.md, README.md
   - Lower priority: API.md, advanced guides

---

## 🎯 Success Criteria (Week 7 Done)

- [ ] All auth endpoints have rate limiting
- [ ] All services have Helmet + secure CORS
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] CI pipeline runs on GitHub Actions
- [ ] Documentation complete (at least: README, SETUP, SECURITY)
- [ ] Linter passes (`npm run lint`)
- [ ] No production blockers remaining

**→ Ready for Week 8 (Deployment)**

---

_Created: 2026-03-03_
