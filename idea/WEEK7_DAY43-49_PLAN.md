# Tuần 7 — Hardening: Rate Limiting + Security Headers + E2E + CI/CD

**Phạm vi:** Day 43–49 theo `DAILY_SCHEDULE_CORE_V1.md`  
**Mục tiêu:** Hoàn thiện các tính năng bảo mật, testing và CI/CD để chuẩn bị production

---

## 🎯 Mục tiêu chính Week 7

**Hardening & Production Readiness** — Đưa hệ thống lên production-ready với:

1. **Advanced Rate Limiting** (Redis-based) cho auth & API endpoints
2. **Security Headers** (Helmet) & CORS Allowlist
3. **E2E Tests** cho full flows (auth, RBAC, notifications, WebSocket)
4. **CI/CD** với GitHub Actions
5. **Documentation** (security, operations, testing guide)

---

## 📊 Tình trạng hiện tại (Đã làm)

### ✅ Hoàn thành Week 1-6:
- Week 1-2: Auth core (register/login/JWT/refresh)
- Week 3: Forgot password + NATS + BullMQ + Email
- Week 4: RBAC + permission guard + internal JWT
- Week 5: Notification schema + idempotency framework
- Week 6: WebSocket realtime + load testing

### ⚠️ Week 7 Status: **CHƯA BẮT ĐẦU (0%)**

---

## ❌ Các công việc còn thiếu Week 7

### Day 43: Advanced Rate Limiting (Redis) ❌

**Hiện trạng:**
- ✅ WebSocket có in-memory rate limit (10 msg/sec/user)
- ✅ Redis đã chạy trong docker-compose
- ❌ **KHÔNG CÓ** rate limiting trên HTTP endpoints
- ❌ **KHÔNG CÓ** rate limiter service cho auth/API

**Cần làm:**
- [ ] Cài đặt `ioredis` vào package.json (hiện chỉ import chứ chưa declare)
- [ ] Tạo `RateLimiterService` trong `packages/common` (hoặc mỗi service)
- [ ] Implement Redis Lua script hoặc INCR+EXPIRE pattern
- [ ] Tạo decorator `@RateLimit()` và guard `RateLimitGuard`
- [ ] Áp dụng rate limit cho:
  - `rl:login:ip:<ip>` — Login attempts per IP (e.g., 5/minute)
  - `rl:login:email:<hash>` — Login attempts per email (e.g., 3/minute)
  - `rl:forgot:email:<hash>` — Forgot password per email (e.g., 2/10min)
  - `rl:api:<userId>:<action>` — API calls per user/action (e.g., 100/minute)
- [ ] Return 429 status với message chung ("Too many requests, please try again later")
- [ ] Log internally với traceId khi rate limit hit

### Day 44: Helmet + CORS Allowlist ❌

**Hiện trạng:**
- ❌ **KHÔNG CÓ** Helmet middleware
- ❌ **KHÔNG CÓ** security headers (CSP, HSTS, X-Frame-Options, etc.)
- ⚠️ CORS insecure:
  - WebSocket: `cors: { origin: '*', credentials: true }` → VULNERABLE
  - HTTP: Không có explicit CORS config trong main.ts
- ❌ **KHÔNG CÓ** allowlist configuration

**Cần làm:**
- [ ] Cài đặt `helmet` package:
  ```bash
  npm install helmet
  npm install --save-dev @types/helmet
  ```
- [ ] Cấu hình Helmet trong `main.ts` của 3 services:
  ```typescript
  import helmet from 'helmet';
  app.use(helmet({
    contentSecurityPolicy: {...}, // CSP rules
    hsts: { maxAge: 31536000 }, // HSTS
    frameguard: { action: 'deny' }, // X-Frame-Options
  }));
  ```
- [ ] Thêm CORS allowlist từ env vars:
  ```typescript
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  ```
- [ ] Sửa WebSocket CORS từ `origin: '*'` sang allowlist:
  ```typescript
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }
  ```
- [ ] Thêm env vars vào `.env.example`:
  ```
  CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
  ```
- [ ] Test security headers bằng `curl -I http://localhost:3000`

### Day 45: E2E Tests Full Flows ❌

**Hiện trạng:**
- ⚠️ Minimal E2E tests:
  - `apps/gateway/test/app.e2e-spec.ts` — chỉ test `GET / => 200`
  - `apps/auth-service/test/app.e2e-spec.ts` — chỉ test `GET / => 200`
  - `apps/notification-service/test/app.e2e-spec.ts` — chỉ test `GET / => 200`
- ✅ Unit tests có một số (`.spec.ts` files)
- ✅ WebSocket load test có (`test/ws/load-test.ts`)
- ❌ **KHÔNG CÓ** full flow integration tests
- ❌ **KHÔNG CÓ** test DB setup/teardown

**Cần làm:**
- [ ] Setup test database:
  - Tạo `docker-compose.test.yml` với Postgres test instance
  - Script `setup-test-db.sh` để chạy migrations
- [ ] Tạo test fixtures & seed data:
  - User fixtures (admin, user)
  - Role/permission fixtures
  - Notification fixtures
- [ ] E2E Auth Flow (`apps/gateway/test/auth.e2e-spec.ts`):
  - [ ] Register → verify email → login → get access token
  - [ ] Login with wrong password → 401
  - [ ] Refresh token → get new access token
  - [ ] Logout → refresh token invalid
  - [ ] Logout all → all sessions revoked
- [ ] E2E RBAC Flow (`apps/gateway/test/rbac.e2e-spec.ts`):
  - [ ] Create user without permission → 403
  - [ ] Assign role → user gains permissions
  - [ ] Change permVersion → old JWT rejected
  - [ ] Permission cache invalidation
- [ ] E2E Notification Flow (`apps/gateway/test/notifications.e2e-spec.ts`):
  - [ ] Register user → welcome notification created
  - [ ] List notifications → returns paginated results
  - [ ] Unread count → correct
  - [ ] Mark read → readAt updated
  - [ ] Read all → all marked read
- [ ] E2E WebSocket Flow (`apps/gateway/test/websocket.e2e-spec.ts`):
  - [ ] Connect with JWT → authenticated
  - [ ] Connect without JWT → error
  - [ ] Receive `notification:new` event when notification created
  - [ ] Send `notification:read` → notification marked read
  - [ ] Multi-tab sync → all tabs receive `notification:updated`
- [ ] E2E Idempotency Flow (`apps/gateway/test/idempotency.e2e-spec.ts`):
  - [ ] Same idempotency-key + same payload → same response (200)
  - [ ] Same idempotency-key + different payload → 409 Conflict
  - [ ] No idempotency-key → different responses (2 users created)
- [ ] E2E Rate Limiting Flow (`apps/gateway/test/rate-limit.e2e-spec.ts`):
  - [ ] Burst login requests → 429 after limit
  - [ ] Wait for TTL → rate limit reset
  - [ ] Forgot password → rate limited per email
- [ ] npm script:
  ```json
  "test:e2e": "jest --config ./test/jest-e2e.json"
  ```

### Day 46: CI GitHub Actions ❌

**Hiện trạng:**
- ❌ **KHÔNG CÓ** `.github/workflows/` directory
- ❌ **KHÔNG CÓ** CI/CD automation
- ✅ Linting config có (`eslint.config.mjs`)
- ✅ Test infrastructure có (Jest)

**Cần làm:**
- [ ] Tạo `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  
  on:
    push:
      branches: [main, develop]
    pull_request:
      branches: [main, develop]
  
  jobs:
    lint-and-test:
      runs-on: ubuntu-latest
      
      strategy:
        matrix:
          node-version: [18.x, 20.x]
      
      services:
        postgres:
          image: postgres:16
          env:
            POSTGRES_USER: test
            POSTGRES_PASSWORD: test
            POSTGRES_DB: test
          options: >-
            --health-cmd pg_isready
            --health-interval 10s
            --health-timeout 5s
            --health-retries 5
          ports:
            - 5432:5432
        
        redis:
          image: redis:7
          options: >-
            --health-cmd "redis-cli ping"
            --health-interval 10s
            --health-timeout 5s
            --health-retries 5
          ports:
            - 6379:6379
        
        nats:
          image: nats:latest
          options: >-
            --health-cmd "wget --no-verbose --tries=1 --spider http://localhost:8222/healthz || exit 1"
            --health-interval 10s
            --health-timeout 5s
            --health-retries 5
          ports:
            - 4222:4222
      
      steps:
        - name: Checkout code
          uses: actions/checkout@v4
        
        - name: Setup Node.js ${{ matrix.node-version }}
          uses: actions/setup-node@v4
          with:
            node-version: ${{ matrix.node-version }}
            cache: 'npm'
        
        - name: Install dependencies
          run: npm ci
        
        - name: Lint
          run: npm run lint
        
        - name: Run migrations
          run: |
            cd apps/auth-service && npx prisma migrate deploy
            cd apps/notification-service && npx prisma migrate deploy
            cd apps/gateway && npx prisma migrate deploy
          env:
            DATABASE_URL_AUTH: postgresql://test:test@localhost:5432/test?schema=auth
            DATABASE_URL_NOTIFICATION: postgresql://test:test@localhost:5432/test?schema=notification
            DATABASE_URL_GATEWAY: postgresql://test:test@localhost:5432/test?schema=gateway
        
        - name: Unit tests
          run: npm run test
        
        - name: E2E tests
          run: npm run test:e2e
          env:
            DATABASE_URL_AUTH: postgresql://test:test@localhost:5432/test?schema=auth
            DATABASE_URL_NOTIFICATION: postgresql://test:test@localhost:5432/test?schema=notification
            DATABASE_URL_GATEWAY: postgresql://test:test@localhost:5432/test?schema=gateway
            REDIS_URL: redis://localhost:6379
            NATS_URL: nats://localhost:4222
        
        - name: Build
          run: npm run build
        
        - name: Upload coverage (optional)
          uses: codecov/codecov-action@v3
          with:
            files: ./coverage/lcov.info
  ```

- [ ] Tạo `.github/workflows/lint.yml` (chạy nhanh hơn CI, chỉ lint):
  ```yaml
  name: Lint
  
  on:
    pull_request:
  
  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20.x
        - run: npm ci
        - run: npm run lint
  ```

- [ ] Thêm badges vào README:
  ```markdown
  ![CI](https://github.com/yourusername/backend-core-platform/workflows/CI/badge.svg)
  ![Lint](https://github.com/yourusername/backend-core-platform/workflows/Lint/badge.svg)
  ```

### Day 47-49: Refactor + Documentation ⚠️ Một phần

**Hiện trạng:**
- ⚠️ Có một số docs trong `idea/` folder (internal, không phải user-facing)
- ⚠️ README files là boilerplate (NestJS default)
- ❌ **KHÔNG CÓ** root README với setup guide
- ❌ **KHÔNG CÓ** docs/ folder cho user documentation

**Cần làm:**

#### 1. Root README.md (CRITICAL)
- [ ] Tạo `README.md` tại root với nội dung:
  ```markdown
  # Backend Core Platform
  
  Monorepo NestJS microservices: Auth, Gateway, Notifications
  
  ## Features
  - JWT auth with refresh tokens
  - RBAC (Role-Based Access Control)
  - Real-time WebSocket notifications
  - Event-driven architecture (NATS JetStream)
  - Async job queue (BullMQ)
  - Idempotency framework
  - Rate limiting (Redis)
  - E2E tested & CI/CD ready
  
  ## Quick Start
  1. Clone repo
  2. `npm install`
  3. `docker-compose -f infra/docker-compose.dev.yml up -d`
  4. Run migrations (see docs/SETUP.md)
  5. `npm run dev:gateway`
  
  ## Architecture
  See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
  
  ## Documentation
  - [Setup Guide](docs/SETUP.md)
  - [Architecture](docs/ARCHITECTURE.md)
  - [Security](docs/SECURITY.md)
  - [RBAC & Permissions](docs/RBAC.md)
  - [Testing](docs/TESTING.md)
  - [Operations](docs/OPERATIONS.md)
  ```

#### 2. docs/SETUP.md (Setup guide)
- [ ] Prerequisites (Node, Docker, npm)
- [ ] Environment variables setup
- [ ] Database migrations
- [ ] Running services locally
- [ ] Troubleshooting common issues

#### 3. docs/ARCHITECTURE.md
- [ ] System overview diagram
- [ ] Service descriptions:
  - Gateway (BFF, WebSocket server)
  - Auth-service (Auth + RBAC)
  - Notification-service (Notifications + email)
- [ ] Data flow diagrams:
  - User registration → email verification
  - Login → JWT issuance
  - Notification creation → WebSocket push
- [ ] Technology stack:
  - NestJS, TypeScript, Prisma, PostgreSQL
  - NATS JetStream, Redis, BullMQ
  - Socket.IO, Nodemailer
- [ ] Database schema overview

#### 4. docs/SECURITY.md (CRITICAL)
- [ ] Authentication flow (JWT access + refresh)
- [ ] Authorization (RBAC, permission guards)
- [ ] Internal JWT for service-to-service
- [ ] Rate limiting strategy:
  - Login endpoints (per IP, per email)
  - API endpoints (per user, per action)
- [ ] Security headers (Helmet):
  - CSP, HSTS, X-Frame-Options
- [ ] CORS configuration (allowlist)
- [ ] Password hashing (Argon2)
- [ ] SQL injection prevention (Prisma ORM)
- [ ] Error handling (no stack traces in prod)
- [ ] Secret management (env vars, no commits)

#### 5. docs/RBAC.md (đã có RBAC_OVERVIEW, cần refactor)
- [ ] Move `idea/RBAC_OVERVIEW_AND_HOW_TO_ADD_PERMISSION.md` → `docs/RBAC.md`
- [ ] Clean up formatting
- [ ] Add examples:
  - Assigning roles to users
  - Creating new permissions
  - Checking permissions in code

#### 6. docs/TESTING.md
- [ ] Testing strategy:
  - Unit tests (Jest)
  - E2E tests (Supertest)
  - Load tests (WebSocket)
- [ ] Running tests:
  - `npm run test` — unit tests
  - `npm run test:e2e` — E2E tests
  - `npm run test:ws-load` — WebSocket load test
- [ ] Writing new tests:
  - Test fixtures
  - Database setup/teardown
  - Mocking external services
- [ ] CI/CD integration

#### 7. docs/OPERATIONS.md
- [ ] Monitoring & logging:
  - Structured logging (Pino, JSON)
  - Request ID / Trace ID propagation
  - Log levels (debug, info, warn, error)
- [ ] Error handling:
  - ServiceError codes
  - Error sanitization
  - 4xx vs 5xx errors
- [ ] Health checks:
  - `GET /health` endpoints
  - Database connectivity
  - NATS connectivity
- [ ] Job queue management:
  - BullMQ dashboard (optional)
  - Failed job handling
  - DLQ (Dead Letter Queue)
- [ ] Database migrations:
  - `npx prisma migrate dev` (development)
  - `npx prisma migrate deploy` (production)

#### 8. docs/API.md hoặc Swagger/OpenAPI (optional, nice to have)
- [ ] Install `@nestjs/swagger`
- [ ] Annotate controllers với `@ApiTags`, `@ApiOperation`
- [ ] Serve Swagger UI tại `/api-docs`
- [ ] Generate OpenAPI spec

#### 9. Update .env.example files
- [ ] Thêm các env vars mới cho Week 7:
  ```
  # Rate Limiting
  RATE_LIMIT_LOGIN_IP_WINDOW=60000        # 1 minute
  RATE_LIMIT_LOGIN_IP_MAX=5               # 5 attempts per IP
  RATE_LIMIT_LOGIN_EMAIL_WINDOW=60000     # 1 minute
  RATE_LIMIT_LOGIN_EMAIL_MAX=3            # 3 attempts per email
  RATE_LIMIT_FORGOT_PASSWORD_WINDOW=600000 # 10 minutes
  RATE_LIMIT_FORGOT_PASSWORD_MAX=2        # 2 attempts per email
  RATE_LIMIT_API_WINDOW=60000             # 1 minute
  RATE_LIMIT_API_MAX=100                  # 100 requests per user
  
  # CORS
  CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
  
  # Security
  HELMET_ENABLED=true
  ```

---

## 🔐 Security Issues cần fix NGAY (Production Blockers)

| Issue | Severity | Impact | Fix |
|-------|----------|--------|-----|
| No HTTP rate limiting | 🔴 CRITICAL | Brute force vulnerable | Implement Redis rate limiter |
| CORS wildcard `origin: '*'` | 🔴 CRITICAL | CSRF vulnerable | Use allowlist from env |
| No security headers | 🟡 HIGH | Missing CSP, HSTS, etc. | Add Helmet middleware |
| `ioredis` not in package.json | 🟡 HIGH | Runtime error risk | Add to dependencies |

---

## 🏗️ Cấu trúc thư mục cần tạo

```
f:\project\backend-core-platform/
├── .github/
│   └── workflows/
│       ├── ci.yml               # ❌ NEW - CI pipeline
│       └── lint.yml             # ❌ NEW - Lint check
│
├── docs/                        # ❌ NEW - User documentation
│   ├── SETUP.md                 # Setup guide
│   ├── ARCHITECTURE.md          # System design
│   ├── SECURITY.md              # Security practices
│   ├── RBAC.md                  # RBAC guide (move from idea/)
│   ├── TESTING.md               # Testing strategy
│   ├── OPERATIONS.md            # Ops guide
│   └── API.md                   # API reference (optional)
│
├── packages/
│   └── common/
│       └── src/
│           └── rate-limiter/    # ❌ NEW - Rate limiter module
│               ├── rate-limiter.module.ts
│               ├── rate-limiter.service.ts
│               ├── rate-limiter.guard.ts
│               └── rate-limiter.decorator.ts
│
├── apps/
│   ├── gateway/
│   │   ├── test/
│   │   │   ├── auth.e2e-spec.ts          # ❌ NEW - Auth E2E tests
│   │   │   ├── rbac.e2e-spec.ts          # ❌ NEW - RBAC E2E tests
│   │   │   ├── notifications.e2e-spec.ts # ❌ NEW - Notification E2E
│   │   │   ├── websocket.e2e-spec.ts     # ❌ NEW - WebSocket E2E
│   │   │   ├── idempotency.e2e-spec.ts   # ❌ NEW - Idempotency E2E
│   │   │   └── rate-limit.e2e-spec.ts    # ❌ NEW - Rate limit E2E
│   │   └── src/main.ts           # ⚠️ UPDATE - Add helmet, CORS
│   │
│   ├── auth-service/
│   │   └── src/main.ts           # ⚠️ UPDATE - Add helmet, CORS, rate limit
│   │
│   └── notification-service/
│       └── src/main.ts           # ⚠️ UPDATE - Add helmet, CORS
│
├── infra/
│   └── docker-compose.test.yml  # ❌ NEW - Test environment
│
├── README.md                    # ❌ NEW - Project overview
├── .env.example                 # ⚠️ UPDATE - Add new env vars
└── package.json                 # ⚠️ UPDATE - Add helmet, ioredis
```

---

## 📦 Dependencies cần cài đặt

```bash
# Root level
npm install helmet ioredis
npm install --save-dev @types/helmet @types/ioredis

# Optional: NestJS throttler (alternative to custom rate limiter)
npm install @nestjs/throttler

# Optional: Swagger/OpenAPI
npm install @nestjs/swagger swagger-ui-express
```

---

## 🎯 Thứ tự thực hiện đề xuất

### Phase 1: Security (Ưu tiên cao) — 2-3 ngày
1. **Day 43:** Advanced Rate Limiting
   - [ ] Cài đặt ioredis vào package.json
   - [ ] Tạo RateLimiterService trong packages/common
   - [ ] Áp dụng rate limit cho login (IP + email)
   - [ ] Áp dụng rate limit cho forgot password
   - [ ] Áp dụng rate limit cho API endpoints
   - [ ] Test với curl/Postman (burst requests)
   
2. **Day 44:** Helmet + CORS
   - [ ] Cài đặt helmet
   - [ ] Cấu hình Helmet trong 3 services
   - [ ] Thêm CORS allowlist từ env vars
   - [ ] Sửa WebSocket CORS
   - [ ] Test security headers với `curl -I`

### Phase 2: Testing — 2-3 ngày
3. **Day 45:** E2E Tests
   - [ ] Setup test database (docker-compose.test.yml)
   - [ ] Tạo test fixtures
   - [ ] E2E auth flow tests
   - [ ] E2E RBAC tests
   - [ ] E2E notification tests
   - [ ] E2E WebSocket tests
   - [ ] E2E idempotency tests
   - [ ] E2E rate limit tests
   - [ ] `npm run test:e2e` pass

### Phase 3: CI/CD — 1 ngày
4. **Day 46:** GitHub Actions
   - [ ] Tạo `.github/workflows/ci.yml`
   - [ ] Tạo `.github/workflows/lint.yml`
   - [ ] Test CI trên branch mới (tạo PR)
   - [ ] Verify CI pass

### Phase 4: Documentation — 2-3 ngày
5. **Day 47-49:** Docs + Refactor
   - [ ] Tạo `README.md` (root)
   - [ ] Tạo `docs/SETUP.md`
   - [ ] Tạo `docs/ARCHITECTURE.md`
   - [ ] Tạo `docs/SECURITY.md` (CRITICAL)
   - [ ] Move & clean `docs/RBAC.md`
   - [ ] Tạo `docs/TESTING.md`
   - [ ] Tạo `docs/OPERATIONS.md`
   - [ ] Update `.env.example` files
   - [ ] (Optional) Swagger/OpenAPI integration

---

## ✅ Definition of Done (Week 7)

### Security ✅
- [x] Rate limiting implemented on all auth endpoints (login, register, forgot-password)
- [x] Rate limiting implemented on API endpoints (per user)
- [x] Helmet middleware configured with security headers
- [x] CORS allowlist từ env vars (không còn `origin: '*'`)
- [x] All services return 429 for rate limit violations
- [x] Security headers verified với `curl -I` (CSP, HSTS, X-Frame-Options)

### Testing ✅
- [x] E2E tests cover:
  - Auth flow (register → login → refresh → logout)
  - RBAC (assign role → check permission)
  - Notifications (list → mark read → read all)
  - WebSocket (connect → authenticate → events)
  - Idempotency (duplicate requests)
  - Rate limiting (burst requests)
- [x] Test database setup automated
- [x] `npm run test:e2e` pass
- [x] Test coverage > 70% (optional goal)

### CI/CD ✅
- [x] GitHub Actions CI workflow
- [x] CI runs on push to main/develop
- [x] CI runs on PRs
- [x] CI steps: checkout → install → lint → test → build
- [x] Matrix builds (Node 18.x, 20.x)
- [x] Test infrastructure (Postgres, Redis, NATS) in CI

### Documentation ✅
- [x] Root `README.md` với quick start
- [x] `docs/SETUP.md` — setup guide
- [x] `docs/ARCHITECTURE.md` — system design
- [x] `docs/SECURITY.md` — security practices (CRITICAL)
- [x] `docs/RBAC.md` — RBAC guide
- [x] `docs/TESTING.md` — testing strategy
- [x] `docs/OPERATIONS.md` — operations guide
- [x] `.env.example` updated với new vars

### Code Quality ✅
- [x] Linter errors resolved (`npm run lint` pass)
- [x] No console.log (use structured logger)
- [x] No hardcoded secrets
- [x] Error handling consistent (ServiceError)

---

## 📈 Success Metrics

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| Rate limit coverage | 100% auth endpoints | 0% | ❌ 100% |
| Security headers | All services | 0/3 services | ❌ 3/3 |
| CORS secure | No wildcards | 1 wildcard | ⚠️ Fix WS |
| E2E test coverage | 6 test suites | 3 minimal | ❌ +6 suites |
| CI/CD automation | GitHub Actions | None | ❌ New |
| Documentation | 7 docs | 2 partial | ❌ +5 docs |

---

## 🚨 Risks & Blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limiter affects legit users | High | Tune limits based on usage patterns; whitelist IPs |
| Helmet CSP breaks frontend | Medium | Test with actual frontend; adjust CSP rules |
| E2E tests slow down CI | Medium | Run unit tests first; parallelize E2E tests |
| Documentation incomplete | Low | Prioritize SECURITY.md & SETUP.md; defer API.md |

---

## 📞 Next Steps (Để bắt đầu Day 43)

### Immediate Actions:
1. **Install dependencies:**
   ```bash
   cd f:\project\backend-core-platform
   npm install helmet ioredis
   npm install --save-dev @types/helmet @types/ioredis
   ```

2. **Create RateLimiterService:**
   ```bash
   mkdir packages/common/src/rate-limiter
   touch packages/common/src/rate-limiter/rate-limiter.module.ts
   touch packages/common/src/rate-limiter/rate-limiter.service.ts
   touch packages/common/src/rate-limiter/rate-limiter.guard.ts
   touch packages/common/src/rate-limiter/rate-limiter.decorator.ts
   ```

3. **Start coding rate limiter:**
   - Implement Redis INCR+EXPIRE pattern
   - Create `@RateLimit()` decorator
   - Create `RateLimitGuard`
   - Apply to auth endpoints

4. **Test rate limiter:**
   ```bash
   # Burst login requests
   for i in {1..10}; do curl -X POST http://localhost:3000/client/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"wrong"}'; done
   
   # Should see 429 after 5 attempts (if limit is 5/minute)
   ```

---

## 🎓 Learning Resources

### Rate Limiting:
- Redis INCR pattern: https://redis.io/commands/incr/
- Sliding window algorithm: https://medium.com/@vigneshsklm/rate-limiting-using-redis-and-lua-script-7e0f6b82c0a6

### Security Headers:
- Helmet.js docs: https://helmetjs.github.io/
- OWASP Security Headers: https://owasp.org/www-project-secure-headers/

### E2E Testing:
- NestJS Testing docs: https://docs.nestjs.com/fundamentals/testing
- Supertest: https://github.com/ladjs/supertest

### CI/CD:
- GitHub Actions docs: https://docs.github.com/en/actions
- Service containers: https://docs.github.com/en/actions/using-containerized-services

---

**🚀 Let's ship a production-ready platform! Week 7 → Week 8 (deployment) → v1.0 DONE!**

---

_File này được tạo ngày 2026-03-03 từ phân tích `DAILY_SCHEDULE_CORE_V1.md`, code audit, và subagent exploration report._
