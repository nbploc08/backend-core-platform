# Release Note

- **Release date**: 03/03/2026
- **Scope**: Gateway — WebSocket Load Test Script + Import Path Standardization
- **Device**: Backend API (NestJS) — gateway, auth-service, notification-service
- **Branch**: `37-v1-week6-day41-42-load-testing`

## Overview

- **WebSocket Load Test**: Hoàn thành script load test cho hệ thống WebSocket, mô phỏng 50+ clients kết nối đồng thời, kiểm tra latency, rate limiting, multi-tab sync, và stability.
- **Import Path Standardization**: Chuyển đổi tất cả relative imports (`../`, `../../`) trong `apps/` sang absolute imports (`src/modules/...`, `src/entities/...`) để code dễ maintain và refactor.
- **Test Infrastructure**: Thêm dependencies (`socket.io-client`, `tsx`) và npm script `test:ws-load` để chạy load test standalone.

## Changes

### Gateway

- **WebSocket Load Test Script** (mới)
  - File: `test/ws/load-test.ts` — script chính chạy 6 phases.
  - File: `test/ws/helpers.ts` — config, JWT generation, MetricsTracker, utilities.
  - Chạy bằng: `npm run test:ws-load` (hoặc `npx tsx test/ws/load-test.ts`).

- **6 Test Phases**
  1. **Phase 1 — Connect**: Kết nối N clients với ramp-up delay, đo connection time.
  2. **Phase 2 — Ping/Pong**: Gửi ping từ tất cả clients (3 rounds), đo latency (avg/p95/p99).
  3. **Phase 3 — Notification Read**: Gửi `notification:read` từ subset clients, verify handler hoạt động.
  4. **Phase 4 — Rate Limit Stress**: Burst 25 messages từ 1 client, verify rate limiter chặn đúng.
  5. **Phase 5 — Multi-Tab**: Tạo 5 users × 3 tabs/user, verify multi-connection cho cùng userId.
  6. **Phase 6 — Disconnect**: Ngắt kết nối tất cả clients, verify cleanup không leak memory.

- **MetricsTracker**
  - Track: connection successes/failures, messages sent/received, ping latencies, rate limit hits, errors.
  - Report: Tổng hợp connection time (avg/min/max), ping latency (avg/p95/p99/min/max), pass/fail status.

- **Environment Variables** (optional)
  - `WS_URL` — WebSocket target (default: `http://localhost:3000`).
  - `JWT_SECRET` — Must match gateway's JWT_SECRET (default: `change-me`).
  - `JWT_ISSUER` — (default: `auth-service`).
  - `JWT_AUDIENCE` — (default: `api`).
  - `NUM_CLIENTS` — Number of concurrent clients (default: 50).
  - `RAMP_UP_DELAY_MS` — Delay between each client connect (default: 50ms).

- **package.json**
  - Thêm script: `"test:ws-load": "tsx test/ws/load-test.ts"`.
  - Thêm dev dependencies: `socket.io-client@^4.8.1`, `tsx@^4.19.2`.

### All Services (Gateway, Auth-service, Notification-service)

- **Import Path Standardization**
  - Chuyển đổi tất cả relative imports sang absolute imports trong `apps/` directories.
  - Ví dụ: `from '../../../websocket/websocket.gateway'` → `from 'src/modules/websocket/websocket.gateway'`.
  - Ví dụ: `from '../../entities/user.entities'` → `from 'src/entities/user.entities'`.
  - Áp dụng cho: Gateway (3 files), Auth-service (6 files), Notification-service (6 files).
  - Packages (`packages/common/`) giữ nguyên relative imports (internal package references).

## Test Results

Kết quả mẫu khi chạy `npm run test:ws-load`:

```
=========================================================
  WebSocket Load Test
=========================================================
  Target       : http://localhost:3000
  Clients      : 50
  Ramp-up      : 50ms / client
=========================================================

[Phase 1] Connecting 50 clients...
  -> Connected: 50 / 50

[Phase 2] Ping/Pong latency (3 rounds x 50 clients)...
  -> Round 1/3 done
  -> Round 2/3 done
  -> Round 3/3 done

[Phase 3] Notification:read functional test (10 clients)...
  -> Sent 10 notification:read messages

[Phase 4] Rate limit stress test...
  -> Burst 25 msgs => 15 rate-limited
  -> Rate limiting is working correctly

[Phase 5] Multi-tab simulation (5 users x 3 tabs)...
  -> Created 15 multi-tab connections
  -> Multi-tab clients disconnected

[Phase 6] Disconnecting 50 clients...
  -> All clients disconnected

╔═══════════════════════════════════════════════════════╗
║            WS LOAD TEST REPORT                       ║
╠═══════════════════════════════════════════════════════╣
║  Duration             : 15.2s                         ║
║  Total Clients        : 50                            ║
║                                                       ║
║  ── Connections ──────────────────────────────────── ║
║  Success              : 50                            ║
║  Failed               : 0                             ║
║  Avg Connect Time     : 45.23ms                       ║
║  Min / Max            : 23.10ms / 89.50ms             ║
║                                                       ║
║  ── Messages ────────────────────────────────────── ║
║  Sent                 : 185                           ║
║  Received             : 170                           ║
║  Errors               : 0                             ║
║  Rate Limit Hits      : 15                            ║
║                                                       ║
║  ── Ping Latency ────────────────────────────────── ║
║  Samples              : 150                           ║
║  Avg                  : 8.45ms                        ║
║  P95                  : 15.20ms                       ║
║  P99                  : 22.30ms                       ║
║  Min / Max            : 3.10ms / 28.50ms              ║
║                                                       ║
║  ── Result ──────────────────────────────────────── ║
║  Status               : PASS                          ║
╚═══════════════════════════════════════════════════════╝
```

## Usage

### Chạy Load Test

```bash
# Tại thư mục apps/gateway/
npm run test:ws-load

# Hoặc với custom config
WS_URL=http://localhost:3000 \
JWT_SECRET=your-secret \
NUM_CLIENTS=100 \
RAMP_UP_DELAY_MS=100 \
npm run test:ws-load
```

### Monitoring

Trong khi load test chạy, monitor gateway process:

```bash
# Terminal khác
watch -n 1 'ps aux | grep node'

# Hoặc dùng top/htop để xem CPU, memory
htop -p $(pgrep -f "node.*gateway")
```

### Expected Behavior

- **Connection Success Rate**: 100% (tất cả clients kết nối thành công).
- **Ping Latency**: Avg < 10ms, P95 < 20ms, P99 < 30ms.
- **Rate Limit**: Khi burst > 10 msgs/s, gateway trả error `"Rate limit exceeded"`.
- **Multi-Tab**: Cùng userId có thể kết nối nhiều sockets đồng thời.
- **Memory**: Không tăng sau khi disconnect all clients (no leak).

## Migration

- **Migration required**: No
- **Breaking changes**: No
- **Action required**: 
  - Install dependencies: `npm install` (root level).
  - Verify `JWT_SECRET` khớp giữa gateway và auth-service nếu muốn chạy load test.

## Dependencies

- **Added (root level)**:
  - `socket.io-client@^4.8.1` — WebSocket client library cho load test.
  - `tsx@^4.19.2` — TypeScript executor (standalone script runner).

- **Unchanged**: Các dependency runtime của gateway/auth-service/notification-service không đổi.

## Affected Files

**Gateway**

- `apps/gateway/package.json`
- `apps/gateway/test/ws/load-test.ts` (new)
- `apps/gateway/test/ws/helpers.ts` (new)
- `apps/gateway/src/modules/client/notification-service/notification/events/notification-ws.gateway.ts` (import paths)
- `apps/gateway/src/modules/client/notification-service/notification/events/notification-jetstream.consumer.ts` (import paths)
- `apps/gateway/src/modules/share/idempotency.service.ts` (import paths)

**Auth-service**

- `apps/auth-service/src/modules/auth/auth.service.ts` (import paths)
- `apps/auth-service/src/modules/auth/auth.module.ts` (import paths)
- `apps/auth-service/src/modules/auth/auth.controller.ts` (import paths)
- `apps/auth-service/src/modules/auth/passport/local.strategy.ts` (import paths)
- `apps/auth-service/src/modules/users/users.service.ts` (import paths)
- `apps/auth-service/src/modules/roles/roles.service.ts` (import paths)

**Notification-service**

- `apps/notification-service/src/modules/notification/notification.service.ts` (import paths)
- `apps/notification-service/src/modules/notification/notification.module.ts` (import paths)
- `apps/notification-service/src/modules/jetstream/jetstream.module.ts` (import paths)
- `apps/notification-service/src/modules/jetstream/jetstream-consumer.service.ts` (import paths)
- `apps/notification-service/src/modules/jobs/jobs.module.ts` (import paths)
- `apps/notification-service/src/modules/jobs/jobs.service.ts` (import paths)

**Root**

- `package.json` (dependencies)
- `package-lock.json` (lockfile)

**Documentation**

- `idea/RELEASE_NOTE_Load-Test_WS.md` (new — chi tiết load test)
- `idea/RELEASE_NOTE_37-v1-week6-day41-42-load-testing.md` (file này)

## Notes

- **Load test script** là standalone tool — không chạy qua jest, không require gateway running với test database.
- Để chạy load test thành công, cần:
  1. Gateway đang chạy (`npm run start:dev` trong `apps/gateway/`).
  2. Auth-service đang chạy (để issue JWT nếu cần login thật).
  3. NATS server đang chạy (nếu test notification events).
- **Import path standardization** giúp IDE autocomplete tốt hơn, dễ navigate code, dễ refactor (move files không ảnh hưởng imports).
- File `RELEASE_NOTE_Load-Test_WS.md` (654 lines) chứa giải thích chi tiết từng function, cách chạy, cách đọc report, troubleshooting — tham khảo khi cần.
