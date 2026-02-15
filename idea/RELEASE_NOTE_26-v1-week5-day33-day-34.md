# Ghi chu Phat hanh

**Ngay Phat hanh:** 15/02/2026

**Nhanh:** `26-v1-week5-day33-day-34`

**Pham vi:** Backend API (Gateway Service), Database (Gateway schema)

---

## Tong quan

Ban phat hanh nay bo sung co che idempotency cho luong dang ky tai Gateway, bao gom cache in-memory va luu vet xu ly trong database. He thong nay dam bao request dang ky bi retry se tra ve ket qua on dinh, giam tao trung tai khoan va tuan thu nguyen tac at-least-once delivery.

---

## Cac thay doi

### 1. Gateway Service

**Idempotency service tach rieng cho Gateway:**

- Tao service `IdempotencyService` tai `src/modules/share` de chi Gateway su dung.
- Ho tro:
  - Tinh `requestHash` (method + path + body)
  - Kiem tra cache in-memory (TTL 5 phut)
  - Kiem tra va cap nhat DB record (`processing` -> `completed`/`failed`)
  - Xu ly xung dot idempotency key

**Register flow cap nhat:**

- `AuthClientService.register` goi `IdempotencyService` truoc khi goi Auth Service.
- Neu da co ket qua (cache/DB) thi tra ve ngay.
- Neu xay ra loi mang/HTTP error, record duoc danh dau `failed` de retry sau.

### 2. Database (Gateway schema)

**Status enum cho idempotency:**

- Doi `status` tu `String` sang enum `IdempotencyStatus`.
- Gia tri hop le: `processing`, `completed`, `failed`.

---

## Cac tep duoc sua doi

| Ung dung    | Duong dan Tep                                                              | Mo ta                                     |
| ----------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| **Gateway** | `apps/gateway/src/modules/share/idempotency.service.ts`                    | Service idempotency gom cache + DB flow   |
|             | `apps/gateway/src/modules/client/auth-service/auth/auth-client.service.ts` | Register flow su dung idempotency service |
|             | `apps/gateway/src/modules/client/auth-service/auth/auth-client.module.ts`  | Inject `IdempotencyService`               |
| **DB**      | `apps/gateway/prisma/schema.prisma`                                        | Them enum `IdempotencyStatus`             |

---

## Quy trinh Idempotency (Flow)

**Truong hop 1: Request lan dau (co idempotency-key)**

1. Gateway kiem tra cache in-memory -> miss.
2. Kiem tra DB -> khong co record -> tao record `processing`.
3. Goi Auth Service.
4. Thanh cong -> cap nhat record `completed`, cache response.

**Truong hop 2: Retry request**

- Neu cache in-memory con han -> tra ngay ket qua.
- Neu cache het han -> DB record `completed` -> tra ket qua + cache lai.

**Truong hop 3: Loi mang / timeout**

- Record duoc danh dau `failed`.
- Retry se duoc phep va record chuyen ve `processing`.

**Truong hop 4: Xung dot idempotency key**

- Neu cung key nhung `requestHash` khac nhau -> tra 409 Conflict.

---

## Trien khai & Cau hinh

**Migration:**

- Da tao migration cho enum `IdempotencyStatus` va cap nhat schema Gateway.

**Luu y:**

- Can restart Gateway de ap dung logic moi.
- Neu chay multi-instance Gateway, cache in-memory chi co hieu luc tren tung instance (DB van la nguon su that).

---
