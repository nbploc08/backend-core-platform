# Flow API Forgot Password — NATS + BullMQ

> Chỉ mô tả flow, không sửa code.  
> Giả định: client gọi qua **Gateway** (BFF), auth-service xử lý logic, **BullMQ** dùng để gửi email bất đồng bộ, **NATS** dùng cho event/audit (tuỳ chọn).

---

## 1. Vai trò NATS vs BullMQ trong flow

| Thành phần | Vai trò trong Forgot Password                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NATS**   | Event bus: có thể publish event `user.forgot_password.requested` (audit / sau này notification-service subscribe tạo in-app notification). **Không** dùng NATS để gửi email — email cần retry/backoff/DLQ nên dùng queue. |
| **BullMQ** | Queue job: auth-service **enqueue** job `email.sendReset` vào Redis; **worker** (notification-service) lấy job và gửi email qua SMTP. Có retry, backoff, DLQ.                                                             |

---

## 2. Flow tổng quan (sequence)

```
┌────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐     ┌─────────────────────┐
│ Client │     │ Gateway │     │ Auth-Service │     │  Redis  │     │ Notification-Service │
└───┬────┘     └────┬────┘     └──────┬───────┘     │ (BullMQ)│     │     (Worker)         │
    │               │                 │              └────┬────┘     └──────────┬────────────┘
    │  POST /auth/forgot-password     │                   │                    │
    │  { "email": "user@x.com" }      │                   │                    │
    │───────────────────────────────>│                   │                    │
    │               │                 │                   │                    │
    │               │  forward       │                   │                    │
    │               │  (internal JWT) │                   │                    │
    │               │────────────────>│                   │                    │
    │               │                 │                   │                    │
    │               │                 │ 1. Validate email │                    │
    │               │                 │ 2. Lookup user    │                    │
    │               │                 │ (if exists)       │                    │
    │               │                 │   → create        │                    │
    │               │                 │     PasswordResetToken (hash+expiry)   │
    │               │                 │   → build resetLink                    │
    │               │                 │                   │                    │
    │               │                 │ 3. Enqueue job    │                    │
    │               │                 │   "email.sendReset"                    │
    │               │                 │   payload: { to, resetLink, ... }     │
    │               │                 │──────────────────>│                    │
    │               │                 │                   │  Queue "email"     │
    │               │                 │                   │  Job added        │
    │               │                 │                   │                    │
    │               │                 │ 4. (Optional)     │                    │
    │               │                 │   Publish NATS     │                    │
    │               │                 │   user.forgot_password.requested      │
    │               │                 │                   │                    │
    │               │                 │ 5. Always 200 OK  │                    │
    │               │                 │   (anti-enum)     │                    │
    │               │                 │<──────────────────│                    │
    │               │                 │                   │                    │
    │               │ 200 OK          │                   │                    │
    │               │<────────────────│                   │                    │
    │ 200 OK        │                 │                   │                    │
    │<──────────────│                 │                   │                    │
    │               │                 │                   │                    │
    │               │                 │                   │  Worker picks job  │
    │               │                 │                   │<───────────────────│
    │               │                 │                   │                    │
    │               │                 │                   │  Send email (SMTP) │
    │               │                 │                   │  resetLink        │
    │               │                 │                   │  ────────────────>│  User inbox
```

---

## 3. Flow chi tiết từng bước

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  FORGOT PASSWORD — Chi tiết                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  [Client]                                                                                 │
│     │ POST /auth/forgot-password  { "email": "user@example.com" }                         │
│     ▼                                                                                     │
│  [Gateway]                                                                                 │
│     │ Forward to auth-service (internal JWT), propagate requestId                         │
│     ▼                                                                                     │
│  [Auth-Service]                                                                            │
│     │ 1. Validate body (email format)                                                     │
│     │ 2. Normalize email (lowercase, trim)                                                │
│     │ 3. Find user by email (DB)                                                          │
│     │                                                                                     │
│     │    ┌─ User KHÔNG tồn tại ──────────────────────────────────────────────────────┐   │
│     │    │  → Không tạo token, không enqueue job                                      │   │
│     │    │  → Vẫn trả 200 OK (anti-enumeration)                                       │   │
│     │    └───────────────────────────────────────────────────────────────────────────┘   │
│     │                                                                                     │
│     │    ┌─ User TỒN TẠI ───────────────────────────────────────────────────────────┐   │
│     │    │  a) Tạo PasswordResetToken: tokenHash, expiresAt (vd 1h)                   │   │
│     │    │  b) Build resetLink = frontend URL + token (raw token chỉ gửi 1 lần qua mail)│   │
│     │    │  c) Enqueue BullMQ: queue "email", job name "sendReset", data:              │   │
│     │    │       { to, subject, resetLink, requestId? }  (contract-first + Zod)        │   │
│     │    │  d) (Tuỳ chọn) Publish NATS: user.forgot_password.requested                │   │
│     │    └───────────────────────────────────────────────────────────────────────────┘   │
│     │ 4. Response 200 OK  (body có thể generic: "If email exists, you will receive...")   │
│     ▼                                                                                     │
│  [Redis — BullMQ Queue "email"]                                                            │
│     │ Job "sendReset" nằm trong queue                                                     │
│     ▼                                                                                     │
│  [Notification-Service — Worker]                                                          │
│     │ 1. Worker process job "sendReset"                                                  │
│     │ 2. Validate payload (Zod)                                                          │
│     │ 3. Mailer.sendMail({ to, subject, html với resetLink })                            │
│     │ 4. Job complete (hoặc fail → retry → sau N lần → DLQ, Day 20)                       │
│     ▼                                                                                     │
│  [User] Nhận email, click resetLink → gọi POST /auth/reset-password (flow khác, Day 19)   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Flow Reset Password (sau khi user click link trong email)

```
┌────────┐     ┌─────────┐     ┌──────────────┐
│ Client │     │ Gateway │     │ Auth-Service │
└───┬────┘     └────┬────┘     └──────┬───────┘
    │               │                 │
    │  POST /auth/reset-password      │
    │  { "token": "...", "newPassword": "..." }
    │───────────────────────────────>│
    │               │  forward       │
    │               │────────────────>│
    │               │                 │ 1. Hash token → lookup PasswordResetToken
    │               │                 │ 2. Check !usedAt, expiresAt > now
    │               │                 │ 3. Update user.passwordHash (argon2)
    │               │                 │ 4. Mark token used
    │               │                 │ 5. Revoke all sessions (RefreshToken)
    │               │                 │ 6. 200 OK
    │               │                 │
    │               │ 200 OK          │
    │ 200 OK        │<────────────────│
    │<──────────────│
```

---

## 5. Sơ đồ luồng dữ liệu (NATS vs BullMQ)

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                     FORGOT PASSWORD                       │
                    └──────────────────────────────────────────────────────────┘

     Client
        │
        │ POST /auth/forgot-password
        ▼
    ┌─────────┐
    │ Gateway │ ── internal JWT ──► Auth-Service
    └─────────┘
                    │
                    │ 1. DB: User, PasswordResetToken
                    │ 2. Enqueue job (payload contract)
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │  Redis  │  │  NATS   │  │ Response│
   │ BullMQ  │  │ (optional)│  │ 200 OK  │
   │ "email" │  │ event   │  │ → Client│
   └────┬────┘  └────┬────┘  └─────────┘
        │            │
        │            │  (audit / in-app noti sau này)
        │            │
        │  Worker    │
        ▼            ▼
   ┌─────────────────────────┐
   │ Notification-Service    │
   │  - BullMQ Worker        │  ← consume "email" queue, send SMTP
   │  - (NATS consumer nếu   │     (retry, backoff, DLQ)
   │    subscribe event)     │
   └─────────────────────────┘
        │
        ▼
   User inbox (email với reset link)
```

---

## 6. Tóm tắt

| Bước | Ai làm                        | Làm gì                                                                                                     |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | Client                        | Gửi POST /auth/forgot-password với email                                                                   |
| 2    | Gateway                       | Forward sang auth-service (internal JWT)                                                                   |
| 3    | Auth-service                  | Validate, lookup user; nếu có → tạo reset token, **enqueue BullMQ** job `email.sendReset`; luôn trả 200 OK |
| 4    | (Tuỳ chọn)                    | Auth-service publish NATS event để audit / in-app noti                                                     |
| 5    | Worker (notification-service) | Lấy job từ queue "email" → gửi email chứa reset link (SMTP)                                                |
| 6    | User                          | Nhận email, click link → gọi reset-password (Day 19)                                                       |

**BullMQ:** dùng để **gửi email bất đồng bộ**, có hàng đợi, retry, DLQ.  
**NATS:** dùng cho **event** (audit / notification in-app), không dùng để gửi email trong flow này.
