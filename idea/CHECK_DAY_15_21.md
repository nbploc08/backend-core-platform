# Check Day 15–21 (Forgot/Reset + Email async qua BullMQ)

Đối chiếu yêu cầu trong `DAILY_SCHEDULE_CORE_V1.md` (Day 16–21) với code hiện tại.

---

## Day 16 — Gmail App Password + nodemailer adapter

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1. Setup env SMTP Gmail | ✅ | `MAIL_USER`, `MAIL_APP_PASSWORD` trong `.env`, dùng Gmail |
| 2. Viết mailer adapter (sendMail) | ✅ | `MailsService.sendMail()` + nodemailer trong `mails.service.ts` |
| 3. Worker thực hiện job `email.sendTest` | ⚠️ | Queue tên `mail` (không phải `email`). Có job `send-verify-code` và `password.reset.requested`, **không có** job `email.sendTest` riêng để test gửi mail |

**Kết luận:** Đủ cho Gmail + sendMail + worker gửi mail. Thiếu job test tên `email.sendTest` (có thể bỏ qua hoặc thêm job test).

---

## Day 17 — PasswordResetToken model (hash + expiry)

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1. Prisma PasswordResetToken: tokenHash, expiresAt, usedAt | ✅ | Model `PasswordReset`: `tokenHash`, `expiresAt`, `used` (boolean, tương đương usedAt) |
| 2. Helper generate token random 32–64 bytes | ⚠️ | Hiện dùng `Math.random().toString(36).substring(2, 15)` (~13 ký tự). Schedule gợi ý 32–64 bytes (có thể dùng `randomBytes(32).toString('base64')` nếu cần mạnh hơn) |

**Kết luận:** Đủ model + hash + expiry + used. Token random có thể tăng entropy nếu cần.

---

## Day 18 — Forgot password endpoint (anti-enumeration) + enqueue email job

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1. `POST /auth/forgot-password` luôn trả OK | ✅ | Hiện tại nếu email **không** tồn tại thì throw `NOT_FOUND` → lộ thông tin “email không tồn tại”. Cần sửa: **luôn trả 200** với message chung (vd: "If the email exists, a reset link has been sent") |
| 2. Nếu email tồn tại: create reset token | ✅ | `createPasswordReset(user.id)` + lưu DB |
| 3. Enqueue BullMQ job `email.sendReset` (payload contract-first + validate) | ✅ | Job name dùng `PASSWORD_RESET_REQUESTED` (`password.reset.requested`), payload validate bằng `PasswordResetRequestedSchema` (contract). Queue name là `mail` |
| 4. Retry/backoff config (attempts, backoff) | ✅ | `defaultJobOptions` trong queue + `queue.add(..., { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })` cho job reset password |

**Kết luận:** Đủ: anti-enumeration + retry/backoff cho job.

---

## Day 19 — Reset password endpoint + revoke sessions

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1. `POST /auth/reset-password` verify token (hash compare) | ✅ | Có verify step (`forgotPasswordVerify` + `verifyPasswordReset`) so sánh code với `tokenHash` qua `verifyPassword` |
| 2. Update passwordHash | ✅ | `resetPassword()` update `user.passwordHash` |
| 3. Mark token used | ✅ | `verifyPasswordReset()` set `used: true` |
| 4. Revoke all sessions | ✅ | Sau khi reset password gọi `logoutAllDevices(userId)` để revoke toàn bộ refresh token |

**Kết luận:** Đủ: verify token, update password, mark used, revoke all sessions.

---

## Day 20 — DLQ (dead-letter) + audit for email failures

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1. BullMQ config: attempts/backoff | ✅ | Đã cấu hình trong auth-service (defaultJobOptions + queue.add options) |
| 2. On failed after N attempts: move to DLQ (hoặc mark failed + store reason) | ✅ | Worker on('failed'): audit log + add vào queue mail-dlq`. “sau N lần fail → chuyển DLQ hoặc lưu lý do” |
| 3. Audit log `email.failed` với traceId | ✅ | worker.on('failed') log event `email.failed`, traceId = job.id |

**Kết luận:** Đủ: attempts/backoff, DLQ (queue `mail-dlq`), audit log `email.failed` với traceId.

---

## Day 21 — Buffer + e2e forgot/reset

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| e2e: forgot/reset, ensure anti-enumeration | ❌ | Không có thư mục/suite e2e cho forgot/reset; anti-enumeration cũng chưa đủ (xem Day 18) |
| verify no secret leaks | ⚠️ | Nên review: token/code không in ra log response, env không lộ trong client |

**Kết luận:** Chưa có e2e forgot/reset; cần đảm bảo anti-enumeration và no secret leaks.

---

## Tóm tắt

| Day | Đủ / Thiếu | Việc cần bổ sung (nếu có) |
|-----|------------|----------------------------|
| 16 | Đủ (thiếu job sendTest) | Tùy chọn: thêm job `email.sendTest` hoặc dùng luôn send-verify-code / password.reset |
| 17 | Đủ | Có thể tăng entropy token (32–64 bytes) |
| 18 | Đủ | — |
| 19 | Đủ | — |
| 20 | Đủ | — |
| 21 | Chưa | E2E forgot/reset, kiểm tra anti-enumeration và no secret leaks |

---

*File này dùng để đối chiếu với `DAILY_SCHEDULE_CORE_V1.md` (Day 15–21). Cập nhật khi code thay đổi.*
