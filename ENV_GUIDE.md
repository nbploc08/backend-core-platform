# Environment Variables Guide

Based on the codebase analysis, these are the required environment variables for each service.
Please ensure your `.env` and `.env.example` files match these requirements.

---

## 1. apps/auth-service

Required for: Authentication, Database, Queue, Event Bus.

```env
# Server
PORT=3001

# Database (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/auth_db?schema=public"

# Redis (Queue/Bull)
REDIS_URL="redis://localhost:6379"

# NATS (Event Bus)
NATS_URL="nats://localhost:4222"

# JWT Configuration (User Tokens)
JWT_SECRET="your-secure-jwt-secret"
JWT_EXPIRES_IN="9000s"             # 2.5 hours
JWT_REFRESH_EXPIRES_IN="604800s"   # 7 days
JWT_ISSUER="auth-service"
JWT_AUDIENCE="api"

# Internal JWT Configuration (Service-to-Service)
INTERNAL_JWT_SECRET="your-secure-internal-secret"
INTERNAL_JWT_ISSUER="auth-service"
INTERNAL_JWT_AUDIENCE="internal"
```

---

## 2. apps/gateway

Required for: API Gateway, Forwarding User JWT, Internal Calls.

```env
# Server
PORT=3000

# Service URLs
AUTH_SERVICE_URL="http://localhost:3001"
NOTIFICATION_SERVICE_URL="http://localhost:3002"

# JWT Configuration (For verifying User Tokens locally in Guard)
JWT_SECRET="your-secure-jwt-secret" # Must match auth-service
JWT_ISSUER="auth-service"
JWT_AUDIENCE="api"

# Internal JWT Configuration (For signing tokens to call other services)
INTERNAL_JWT_SECRET="your-secure-internal-secret" # Must match other services
INTERNAL_JWT_ISSUER="gateway"
INTERNAL_JWT_AUDIENCE="internal"
```

---

## 3. apps/notification-service

Required for: Notification Logic, Emails, Database, Queue, Event Bus, User Token Verification.

```env
# Server
PORT=3002

# Database (Prisma - if used)
DATABASE_URL="postgresql://user:password@localhost:5432/notification_db?schema=public"

# Redis (Queue/Bull)
REDIS_URL="redis://localhost:6379"

# NATS (Event Bus)
NATS_URL="nats://localhost:4222"

# Mail Configuration (Nodemailer)
MAIL_USER="your-email@gmail.com"
MAIL_APP_PASSWORD="your-app-password"
# Optional: VERIFY_LINK_BASE_URL="http://localhost:3001" (default)

# JWT Configuration (For verifying forwarded User Tokens)
JWT_SECRET="your-secure-jwt-secret" # Must match auth-service
JWT_ISSUER="auth-service"
JWT_AUDIENCE="api"

# Internal JWT Configuration (For signing/verifying internal calls)
INTERNAL_JWT_SECRET="your-secure-internal-secret" # Must match other services
INTERNAL_JWT_ISSUER="notification-service"
INTERNAL_JWT_AUDIENCE="internal"
```

---

## Common Notes

1.  **JWT_SECRET** and **INTERNAL_JWT_SECRET** must be consistent across all services that verify them.
2.  **REDIS_URL** and **NATS_URL** must point to the same instances for inter-service communication to work correctly.
3.  **MAIL_APP_PASSWORD** is specifically for Gmail/SMTP usage (not your login password if 2FA is enabled).