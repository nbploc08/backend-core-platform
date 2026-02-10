# Day 15 — Add Redis client + BullMQ queue skeleton

**Mục tiêu:** notification-service kết nối Redis, tạo queue BullMQ `email`, worker nhận job; healthcheck worker. **Done:** enqueue job test và worker nhận.

---

## 1. Infra: Redis đã có — thêm config trong services

- **Infra:** Redis đã có trong `infra/docker-compose.dev.yml` (port 6379).
- **Root** `.env.example` đã có `REDIS_URL=redis://localhost:6379`.
- **notification-service:** thêm vào `apps/notification-service/.env.example`:
  - `REDIS_URL=redis://localhost:6379` (dùng chung với root khi chạy local).

Không cần sửa docker-compose; chỉ cần đảm bảo các service cần Redis đọc `REDIS_URL` từ env.

---

## 2. notification-service: BullMQ queue `email`

- **Dependencies:** cài trong `apps/notification-service`:
  - `bullmq` — queue + worker.
  - `ioredis` — Redis client (BullMQ dùng bên dưới).
- **Tạo module queue (ví dụ `QueueModule` hoặc `EmailQueueModule`):**
  - Kết nối Redis từ `REDIS_URL` (dùng `Connection`/`Queue` từ BullMQ).
  - Tạo **Queue** tên `email` (vd: `Queue` từ `bullmq` với `name: 'email'`).
  - Export **Queue** để service khác inject và `.add()` job.
- **Lưu ý:** Nếu sau này tách worker ra app riêng, cùng dùng một `REDIS_URL` và cùng queue name `email` là đủ.

---

## 3. Worker process (chạy cùng service hoặc app riêng)

**Hai lựa chọn:**

- **A) Worker chạy cùng notification-service (đơn giản cho Day 15):**
  - Trong cùng app Nest, tạo **Worker** (BullMQ `Worker`) cho queue `email`.
  - Đăng ký worker trong module (vd `onModuleInit` hoặc provider dùng `onApplicationBootstrap`), process job và log ra (vd `console.log` hoặc logger) để verify.
  - Ưu điểm: một process, dễ chạy `dev:notification-service` và test.

- **B) App riêng `apps/notification-worker`:**
  - App Nest mới chỉ chạy Worker (và healthcheck), không cần HTTP routes ngoài health.
  - Cùng `REDIS_URL` và queue name `email`.
  - Dùng khi muốn scale worker tách khỏi API.

**Gợi ý Day 15:** dùng **A)** — worker trong notification-service.

---

## 4. Healthcheck worker

- **Healthcheck cho Redis/Queue:**
  - Trong `GET /health` (hoặc endpoint riêng `GET /health/queue`):
    - Kiểm tra Redis: ping (qua client dùng cho BullMQ) hoặc kiểm tra connection.
    - Có thể thêm trạng thái worker: đang chạy hay không (vd biến `workerReady` set khi worker `ready`).
- **Format:** giữ chuẩn hiện tại (status, service, timestamp), thêm (optional) `redis: 'ok'`, `queue: 'ok'`, `worker: 'ok'`.

---

## 5. Done: Enqueue job test và worker nhận

- **Cách test:**
  - Thêm endpoint test (vd `POST /debug/queue-test` hoặc `GET /debug/queue-test`) chỉ trong dev:
    - Gọi `emailQueue.add('test', { message: 'hello' })` (hoặc job name khác, miễn worker xử lý đúng).
  - Worker đăng ký process job đó và log (vd `Job received: test`, payload).
- **Verify:** gọi endpoint → xem log của notification-service thấy worker log nhận job và xử lý (ít nhất log ra).

---

## Thứ tự làm gợi ý

1. Thêm `REDIS_URL` vào `apps/notification-service/.env.example` và `.env` local.
2. Cài `bullmq`, `ioredis` trong `apps/notification-service`.
3. Tạo module (vd `EmailQueueModule`):
   - Redis connection từ `REDIS_URL`.
   - Tạo `Queue` name `email`, export để inject.
4. Tạo Worker cho queue `email` trong cùng app (provider hoặc service), trong `process` log job id + payload.
5. Cập nhật health: check Redis (và optional worker).
6. Thêm endpoint test enqueue 1 job; chạy service và gọi endpoint → xem log worker nhận job.

Sau bước 6 bạn đạt **Done:** enqueue job test và worker nhận.
