# Tuần 5 — Notification in-app + NATS events + idempotency framework

**Phạm vi:** Đối chiếu `DAILY_SCHEDULE_CORE_V1.md` (Day 29–35) với code thực tế trong `apps/notification-service`, `apps/gateway`, `apps/auth-service`, `packages/contracts`.

---

## Tổng quan tiến độ Week 5

| Ngày       | Nội dung                                                              | Trạng thái  | Ghi chú                                                                                            |
| ---------- | --------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| **Day 29** | Notification schema + indexes                                         | ⚠ Một phần  | Schema Prisma có, index có; **chưa dùng Prisma trong service**, không có migration                 |
| **Day 30** | Internal APIs (list / unreadCount / markRead / readAll)               | ❌ Chưa làm | Notification-service chưa có endpoint internal, chưa dùng DB                                       |
| **Day 31** | Gateway public APIs bell list + permission                            | ⚠ Một phần  | Gateway có client/controller; **thiếu** permission `notifications:read`, path sai với noti-service |
| **Day 32** | Consume USER_REGISTERED → welcome noti + publish notification.created | ⚠ Một phần  | Consumer có; **chưa** tạo welcome noti trong DB, **chưa** publish `notification.created`           |
| **Day 33** | Idempotency framework (gateway)                                       | ❌ Chưa làm | Không có bảng IdempotencyKey, không có middleware/interceptor idempotency                          |
| **Day 34** | Apply idempotency to markRead                                         | ❌ Chưa làm | Phụ thuộc Day 30 + 33                                                                              |
| **Day 35** | Buffer + pagination polish                                            | ❌ Chưa làm | Chưa có API list/pagination để polish                                                              |

---

## Day 29 — Notification schema đầy đủ + indexes

**Mục tiêu lịch:**

1. Prisma Notification: id, userId, type, title, body, data json, createdAt, readAt.
2. Index: (userId, readAt, createdAt).
3. **Done:** migrate OK.

**Hiện trạng code:**

- **Đã có:** `apps/notification-service/prisma/schema.prisma`
  - Model `Notification`: id (uuid), userId, type, title, body (optional), data (Json?), readAt (DateTime?), createdAt.
  - `@@index([userId, readAt, createdAt])` — đúng theo lịch.
- **Thiếu:**
  - **Không có thư mục `prisma/migrations`** → chưa chạy `prisma migrate dev` (hoặc migrations nằm chỗ khác).
  - **Notification-service không dùng Prisma:** không import PrismaModule/PrismaService, `NotificationService` không gọi `prisma.notification.*` — toàn bộ findAll/findOne/update/remove là stub string.

**Kết luận:** Schema và index đúng trên file; **chưa migrate**, **chưa dùng DB trong service** → Day 29 chưa xong.

**TODO:**

- Chạy `prisma migrate dev` trong notification-service (nếu dùng schema `notification`).
- Thêm PrismaModule + PrismaService, inject vào NotificationService và implement CRUD thật bằng `prisma.notification`.

---

## Day 30 — Notification-service internal APIs (list / unreadCount / markRead / readAll)

**Mục tiêu lịch:**

1. Internal endpoints (require internal JWT): list, unreadCount, markRead, readAll.
2. Return formats chuẩn.
3. **Done:** gateway can call internal endpoints.

**Hiện trạng code:**

- **Notification-service:**
  - Controller: `@Controller('notification')` — chỉ có `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (generic CRUD, implementation là stub).
  - **Không có** endpoint: list theo userId, unreadCount, markRead (POST PATCH .../read), readAll.
  - Service không dùng Prisma → không đọc/ghi bảng notifications.
- **Internal JWT:** notification-service đã có `CombinedJwtAuthGuard` / Internal JWT (Day 26), có thể bảo vệ internal routes khi thêm.

**Kết luận:** **Chưa làm** — thiếu cả endpoint lẫn logic DB.

**TODO:**

- Trong notification-service: dùng Prisma, implement:
  - `GET /notification/internal/list?userId=...` (hoặc path tương đương, có internal JWT) — list notifications của user (có pagination).
  - `GET /notification/internal/unread-count?userId=...` — đếm unread.
  - `POST /notification/internal/:id/read` hoặc `PATCH .../read` — mark one read.
  - `POST /notification/internal/read-all` (body userId) — mark all read.
- Chuẩn hóa response format (vd list: { items, total }, unreadCount: { count }).
- Bảo vệ các route internal bằng Internal JWT.

---

## Day 31 — Gateway public APIs bell list + permission check

**Mục tiêu lịch:**

1. Public endpoints `/notifications` (qua gateway).
2. Permission: `notifications:read`.
3. Map internal errors.
4. **Done:** list/unread endpoints work.

**Hiện trạng code:**

- **Gateway:**
  - Có `NotificationModule` (client), `NotificationController` với prefix `client/notification` (vd `GET client/notification`, `GET client/notification/:id`, ...).
  - Service gọi sang notification-service: `GET notifications`, `GET notifications/:id`, ... (baseURL + `notifications`).
  - **Không có** `@RequirePermission('notifications:read')` (hoặc tương đương) trên các route bell list.
  - PermissionGuard đã có trong AppModule (global) nhưng từng route cần decorator yêu cầu permission.
- **Notification-service:**
  - Controller hiện tại là `@Controller('notification')` → path **singular** `/notification`, trong khi gateway gọi **plural** `/notifications` → **path không khớp** (gateway sẽ 404 nếu baseURL không có prefix).

**Kết luận:** **Một phần** — gateway có client và controller, nhưng: (1) chưa gắn permission `notifications:read`; (2) path gateway ↔ notification-service không nhất quán (notifications vs notification); (3) notification-service chưa có API list/unread thật nên dù path đúng cũng chưa “work”.

**TODO:**

- Thêm `@RequirePermission('notifications:read')` (hoặc decorator tương đương) cho các route GET list/unread.
- Map lỗi upstream sang format chuẩn (đã có handleAxiosError, kiểm tra response body format).

---

## Day 32 — Consume USER_REGISTERED → create welcome notification + publish notification.created

**Mục tiêu lịch:**

1. Notification subscribe `user.registered`.
2. Zod validate payload.
3. Create welcome notification.
4. Publish `notification.created` event.
5. **Done:** register triggers welcome noti.

**Hiện trạng code:**

- **Consumer:** Đã có trong `jetstream-consumer.service.ts`:
  - Subscribe `user.registered`, parse JSON, `UserRegisteredSchema.parse(data)`, gọi `notificationService.create(payload)`.
- **NotificationService.create(payload):**
  - Hiện chỉ: decrypt code → gửi email verify (MailsService.sendVerifyCode), **không** tạo bản ghi notification trong DB, **không** publish `notification.created`.
- **Contract:** `NOTIFICATION_CREATED`, `NotificationCreatedSchema` đã có trong `packages/contracts` (notificationId, userId, type, createdAt, ...).

**Kết luận:** **Một phần** — subscribe + validate payload đã có; **thiếu:** (1) tạo welcome notification trong DB (Prisma), (2) publish event `notification.created` (NATS) với payload đúng contract.

**TODO:**

- Trong `NotificationService.create(userRegisteredEvent)` (hoặc tách method mới cho “welcome noti”):
  - Tạo bản ghi `Notification` (userId, type = 'welcome' hoặc tương đương, title/body).
  - Publish NATS event `notification.created` với payload validate bằng `NotificationCreatedSchema`.
- Giữ lại logic gửi email verify (nếu vẫn dùng chung event) hoặc tách consumer riêng cho email.

---

## Day 33 — Idempotency framework (store & replay) in gateway

**Mục tiêu lịch:**

1. Bảng IdempotencyKey (schema auth hoặc common).
2. Middleware/interceptor: đọc header `Idempotency-Key`, requestHash, store processing/completed + response, replay nếu duplicate, 409 nếu cùng key khác payload.
3. **Done:** duplicate request returns same response.

**Hiện trạng code:**

- Grep toàn repo: **không có** IdempotencyKey, idempotency middleware, idempotency interceptor trong gateway hay auth-service.
- CORE_PLATFORM_PLAN và DAILY_SCHEDULE chỉ mô tả, chưa implement.

**Kết luận:** **Chưa làm.**

**TODO:**

- Quyết định schema lưu idempotency (auth hoặc gateway DB riêng).
- Tạo bảng/migration IdempotencyKey (key, requestHash, status, response body, expiry, ...).
- Interceptor/middleware gateway: đọc `Idempotency-Key`, tính requestHash, kiểm tra đã xử lý chưa → replay response hoặc 409 nếu payload khác, nếu mới thì xử lý và lưu kết quả.

---

## Day 34 — Apply idempotency to POST /notifications/:id/read (demo)

**Mục tiêu lịch:**

1. Bật idempotency cho markRead.
2. Test: cùng key gửi 2 lần → không double update.
3. **Done:** idempotency works.

**Hiện trạng code:**

- Phụ thuộc Day 30 (markRead endpoint) và Day 33 (idempotency framework). Cả hai đều chưa có.

**Kết luận:** **Chưa làm.**

**TODO:**

- Sau khi có markRead (Day 30) và idempotency (Day 33): bật idempotency cho route mark-read, test duplicate key.

---

## Day 35 — Buffer + pagination polish

**Mục tiêu lịch:**

- Pagination + sorting ổn định cho list notifications.

**Hiện trạng code:**

- Notification-service chưa có API list thật (Day 30 chưa xong) → chưa có pagination/sort để polish.

**Kết luận:** **Chưa làm.**

**TODO:**

- Sau Day 30: thêm query params (limit, offset hoặc cursor, sortBy, sortOrder) cho list, trả về format có total/cursor tùy thiết kế.

---

## Thứ tự làm gợi ý (để “unblock” Week 5)

1. **Day 29:** Migrate notification schema + dùng Prisma trong notification-service (CRUD cơ bản cho bảng Notification).
2. **Day 30:** Internal APIs list / unreadCount / markRead / readAll (internal JWT), dùng Prisma.
3. **Day 32:** Trong consumer user.registered: tạo welcome noti trong DB + publish `notification.created`.
4. **Day 31:** Gateway: thống nhất path với notification-service, gọi list/unread, thêm `@RequirePermission('notifications:read')`.
5. **Day 33:** Idempotency framework trong gateway (bảng + interceptor).
6. **Day 34:** Bật idempotency cho markRead.
7. **Day 35:** Pagination + sorting cho list.

---

_File này được tạo từ quét code và đối chiếu với `idea/DAILY_SCHEDULE_CORE_V1.md`, `idea/CORE_PLATFORM_PLAN.md`._
