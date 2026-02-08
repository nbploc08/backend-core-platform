# Kiểm tra Day 10–13 (DAILY_SCHEDULE_CORE_V1)

So với yêu cầu trong `DAILY_SCHEDULE_CORE_V1.md` (dòng 172–198).

---

## Day 10 — Login endpoint + error code chuẩn

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1) `POST /auth/login` | ✅ | Có trong `AuthController` |
| 2) Fail → `AUTH_INVALID_CREDENTIALS` message chung | ✅ | `AuthService.login` throw `ServiceError` với `ErrorCodes.AUTH_INVALID_CREDENTIALS` |
| 3) Success → trả access+refresh (tạm stub) | ✅ | `issueTokens` trả `access_token`, set cookie `refreshToken` + `deviceId` |
| 4) Audit log login_success / login_failed | ✅ | Đã thêm: `login_success` trong AuthService.login; `login_failed` trong LocalStrategy và AuthService (reason: invalid_credentials / account_not_verified) |

**Kết luận Day 10:** Đủ yêu cầu.

---

## Day 11 — JWT access token + guards

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1) JWT config: secret / issuer / audience | ✅ | `AuthModule` signOptions: issuer (JWT_ISSUER), audience (JWT_AUDIENCE). `JwtStrategy` + `refresh()` verify với cùng issuer/audience. |
| 2) Claims: sub, permVersion, iat, exp | ✅ | Payload: `{ sub, email, permVersion }`. `iat`/`exp` do JWT tự thêm. `JwtStrategy.validate` trả thêm `permVersion`. |
| 3) Guard verify JWT | ✅ | `JwtAuthGuard` + `JwtStrategy` |
| 4) Endpoint `GET /me` trả userId | ⚠️ | Có `GET /auth/info` trả thông tin user (id, email, name...), không có route `GET /me` đúng tên |

**Kết luận Day 11:** Đủ trừ route `GET /me` (đang dùng `/auth/info`).

---

## Day 12 — Session table + refresh token hashed

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1) Prisma Session: id, userId, refreshTokenHash, expiresAt, revokedAt, ip, userAgent | ✅ | Model `RefreshToken` có đủ: id, userId, tokenHash, expiresAt, revokedAt, ipAddress, userAgent (+ deviceId, deviceName) |
| 2) Khi login: tạo refresh token random + **hash** lưu session | ✅ | `saveRefreshToken` hash bằng `hashPassword` (argon2) trước khi lưu vào `tokenHash`. Verify bằng `verifyPassword` khi refresh / logout-device. |
| 3) Return refresh token | ✅ | Trả qua cookie `refreshToken` |

**Kết luận Day 12:** Đủ yêu cầu.

---

## Day 13 — Refresh rotation + logout / logout-all

| Yêu cầu | Trạng thái | Ghi chú |
|--------|------------|--------|
| 1) `POST /auth/refresh`: verify refresh token, rotate | ✅ | Có `POST /auth/refresh`, verify JWT, gọi `issueTokens(..., refreshTokenOld)` → rotate |
| 2) `POST /auth/logout`: revoke session | ✅ | Có `POST /auth/logout-device` (revoke session theo device + cookie) |
| 3) `POST /auth/logout-all`: revoke all sessions | ✅ | Có `POST /auth/logout-all` |
| 4) Ensure error codes chuẩn | ✅ | Dùng `AUTH_REFRESH_TOKEN_INVALID` khi refresh sai |
| **Done:** refresh cũ bị revoke | ✅ | Rotation: upsert theo (userId, deviceId) ghi đè `tokenHash` bằng token mới → token cũ không còn hợp lệ |

**Kết luận Day 13:** Đủ yêu cầu (tên route logout là `logout-device` thay vì `logout`).

---

## Tổng kết

| Ngày | Đủ? | Cần bổ sung |
|------|-----|--------------|
| Day 10 | Đủ | — |
| Day 11 | Gần đủ | JWT issuer/audience; claim **permVersion**; route `GET /me` (hoặc chuẩn hóa `/auth/info` ≡ /me) |
| Day 12 | Đủ | — |
| Day 13 | Đủ | — |

---

## Gợi ý chỉnh code nhanh

1. **Day 10 – Audit log:** Trong `AuthService.login` (và trong LocalStrategy/controller nếu cần):
   - Khi login thành công: `logger.info({ action: 'login_success', userId, email }, 'Login success');`
   - Khi login thất bại: `logger.warn({ action: 'login_failed', email? }, 'Login failed');` (trong guard hoặc catch).

2. **Day 11 – JWT:**  
   - Thêm `permVersion` vào payload: `{ sub, email, permVersion: user.permVersion }`.  
   - Cấu hình `signOptions`: `issuer`, `audience` nếu cần.  
   - Thêm `GET /me` trả `{ userId }` (hoặc alias `/auth/info` → /me).

3. **Day 12 – Hash refresh token:**  
   - Trước khi gọi `saveRefreshToken`: `refreshTokenHash = await hashPassword(refreshToken)` (hoặc dùng hàm hash token riêng).  
   - Lưu `refreshTokenHash` vào DB.  
   - Khi refresh: hash token từ cookie rồi so sánh với `tokenHash` trong DB (hoặc tìm row theo userId+deviceId rồi `verifyPassword(storedHash, tokenFromCookie)`).

File này có thể xóa hoặc cập nhật sau khi đã sửa xong các mục trên.
