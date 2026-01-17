# API Security Policy Implementation

## Overview

Centralized API security policy layer that enforces consistent security across all API routes. All routes are protected by `withApiGuard` which enforces:

1. **Dev-only check** - Blocks dev routes in production
2. **Origin enforcement** - Validates origin for state-changing methods (except webhooks)
3. **Rate limiting** - Enforces per-user or per-IP rate limits
4. **Request size limits** - Rejects oversized payloads before parsing
5. **Zod validation** - Validates request bodies and query parameters

## Policy Enforcement Order

The guard enforces policies in this exact order:

1. **Dev-only check** (block in production)
2. **Origin enforcement** (for state-changing methods, except webhooks)
3. **Webhook signature verification** (if required, BEFORE rate limiting)
4. **Rate limiting** (DoS backstop for webhooks, normal enforcement for others)
5. **Request size limit** (before parsing JSON)
6. **Query parameter validation** (if schema provided)
7. **Body validation** (if schema provided)

## Route Policies

### AI Generation Routes

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/generate-pitch` | POST | AI_GENERATION | 1MB | 20 | 1 | ✅ | ❌ |
| `/api/generate-sequence` | POST | AI_GENERATION | 1MB | 20 | 1 | ✅ | ❌ |
| `/api/generate-battle-card` | POST | AI_GENERATION | 1MB | 20 | 1 | ✅ | ❌ |
| `/api/generate-linkedin-comment` | POST | AI_GENERATION | 1MB | 20 | 1 | ✅ | ❌ |

### Write Operations

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/unlock-lead` | POST | WRITE | 512KB | 60 | 10 | ✅ | ❌ |
| `/api/send-pitch` | POST | WRITE | 1MB | 30 | 5 | ✅ | ❌ |
| `/api/push-to-crm` | POST | WRITE | 512KB | 30 | 5 | ✅ | ❌ |
| `/api/settings` | POST | WRITE | 512KB | 30 | 5 | ✅ | ❌ |
| `/api/tags` | POST | WRITE | 256KB | 60 | 10 | ✅ | ❌ |
| `/api/tags` | DELETE | WRITE | 256KB | 60 | 10 | ✅ | ❌ |
| `/api/leads/[leadId]/tags` | POST | WRITE | 256KB | 60 | 10 | ✅ | ❌ |
| `/api/leads/[leadId]/tags` | DELETE | WRITE | 256KB | 60 | 10 | ✅ | ❌ |

### Checkout Operations

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/stripe/checkout` | POST | CHECKOUT | 512KB | 10 | 5 | ✅ | ❌ |
| `/api/checkout` | POST | CHECKOUT | 512KB | 10 | 5 | ✅ | ❌ |

### Read Operations

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/history` | GET | READ | 0 | 100 | 30 | ❌ | ❌ |
| `/api/history/export` | GET | READ | 0 | 30 | 10 | ❌ | ❌ |
| `/api/tags` | GET | READ | 0 | 100 | 30 | ❌ | ❌ |
| `/api/plan` | GET | READ | 0 | 100 | 30 | ❌ | ❌ |
| `/api/whoami` | GET | READ | 0 | 100 | 30 | ❌ | ❌ |
| `/api/stripe/portal` | POST | READ | 0 | 10 | 5 | ✅ | ❌ |
| `/api/tracker` | GET | READ | 0 | 100 | 30 | ❌ | ❌ |

### External API Routes

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/reveal` | POST | EXTERNAL_API | 512KB | 30 | 5 | ✅ | ❌ |
| `/api/verify-email` | POST | EXTERNAL_API | 256KB | 30 | 5 | ✅ | ❌ |
| `/api/tracker` | POST | EXTERNAL_API | 256KB | 100 | 30 | ❌ | ❌ |

### Webhook Routes

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/stripe/webhook` | POST | WEBHOOK | 1MB | 1000 | 100 | ❌ | ✅ |
| `/api/webhook` | POST | WEBHOOK | 1MB | 1000 | 100 | ❌ | ❌ |
| `/api/crypto-pay/webhook` | POST | WEBHOOK | 1MB | 1000 | 100 | ❌ | ❌ |

### Admin/Cron Routes

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|
| `/api/digest/run` | POST | ADMIN | 512KB | 10 | 5 | ❌ | ❌ |
| `/api/digest/test` | POST | ADMIN | 512KB | 10 | 5 | ❌ | ❌ |

### Dev-Only Routes

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin Required | Webhook Sig | Dev Only |
|-------|--------|------|-----------|----------|--------|-----------------|-------------|----------|
| `/api/dev/create-user` | POST | DEV | 256KB | 10 | 5 | ❌ | ❌ | ✅ |
| `/api/test-error` | GET | DEV | 0 | 100 | 30 | ❌ | ❌ | ✅ |

## Implementation Details

### Files Created

1. **`lib/api/policy.ts`** - Centralized policy definitions
   - `getRoutePolicy(pathname, method)` - Get policy for route
   - `getAllRoutePolicies()` - Get all policies (for testing)
   - Explicit mapping for every route (no catch-all except safe default)

2. **`lib/api/guard.ts`** - Security guard wrapper
   - `withApiGuard(handler, options)` - Wrap route handler with security
   - Enforces all policies in correct order
   - Handles webhook signature verification
   - Validates request size before parsing
   - Validates with Zod schemas

### Usage Example

```typescript
import { withApiGuard } from '@/lib/api/guard'
import { CompanyUrlSchema } from '@/lib/api/schemas'
import { ok } from '@/lib/api/http'

export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    const data = body as { companyUrl: string }
    // ... handler logic
    return ok({ success: true }, undefined, undefined, requestId)
  },
  {
    bodySchema: CompanyUrlSchema,
  }
)
```

### Webhook Signature Verification

For webhooks with `webhookSignatureRequired: true`, the guard:
1. Reads raw body as Buffer
2. Verifies signature BEFORE rate limiting
3. Parses body after verification
4. Passes parsed body to handler

**Important**: Webhook signature verification happens BEFORE rate limiting to fail fast on invalid signatures.

### Rate Limiting

Rate limits are enforced per route category:
- **AI_GENERATION**: Stricter limits (20 auth/min, 1 IP/min)
- **WRITE**: Moderate limits (60 auth/min, 10 IP/min)
- **READ**: Looser limits (100 auth/min, 30 IP/min)
- **CHECKOUT**: Stricter limits (10 auth/min, 5 IP/min)
- **WEBHOOK**: High limits (1000 auth/min, 100 IP/min) - DoS backstop only

### Request Size Limits

- Enforced BEFORE parsing JSON
- Checks `Content-Length` header first for fast failure
- Returns 413 (Payload Too Large) with standardized error envelope

### Error Responses

All errors use standardized format:
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "requestId": "request-id"
  }
}
```

## Testing

### Run Tests

```bash
# Test policy mapping
npm run test -- lib/api/policy.vitest.ts

# Test guard enforcement
npm run test -- lib/api/guard.vitest.ts

# Test all API security
npm run test -- lib/api/
```

### Test Coverage

- ✅ Policy mapping covers all routes (fails if missing)
- ✅ MaxBytes rejects oversized payload (413)
- ✅ Rate limit returns 429 with standardized envelope
- ✅ Webhook signature verification
- ✅ Dev-only route blocking in production
- ✅ Origin enforcement for state-changing methods

## Migration Guide

### Updating Routes

1. Import `withApiGuard`:
   ```typescript
   import { withApiGuard } from '@/lib/api/guard'
   ```

2. Wrap handler:
   ```typescript
   export const POST = withApiGuard(
     async (request, { body, userId, requestId }) => {
       // Handler logic
     },
     {
       bodySchema: YourSchema,
       querySchema: YourQuerySchema, // optional
     }
   )
   ```

3. Remove manual validation:
   - Remove `validateBody`, `validateQuery` calls
   - Remove `checkRateLimit` calls
   - Remove `validateOrigin` calls
   - Remove manual request size checks

4. Use context parameters:
   - `body` - Validated request body (if schema provided)
   - `query` - Validated query parameters (if schema provided)
   - `userId` - Authenticated user ID (if authenticated)
   - `requestId` - Request correlation ID

## Notes

- **Webhooks**: Signature verification happens BEFORE rate limiting
- **Origin**: Not enforced for webhooks or GET requests
- **Dev routes**: Automatically blocked in production
- **Default policy**: Unknown routes get safe defaults (1MB, origin required, moderate rate limits)
