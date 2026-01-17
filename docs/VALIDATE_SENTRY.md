# Validating Sentry Error Tracking Locally

This guide shows how to validate that Sentry error tracking is working correctly and that error capture is properly gated in development.

## Prerequisites

1. **Sentry Account**: Sign up at https://sentry.io (free tier is sufficient)
2. **Sentry Project**: Create a Next.js project in Sentry
3. **DSN**: Copy your Sentry DSN from project settings

## Setup

### 1. Configure Sentry DSN (Optional for Testing)

Add to `.env.local`:

```bash
# Server-side Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Client-side Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Note**: In development, Sentry is **disabled by default** unless `SENTRY_DSN` is explicitly set. This prevents accidental error capture during development.

### 2. Start Dev Server

```bash
npm run dev
```

## Validation Tests

### Test 1: Error Capture is Gated in Development

**Expected Behavior**: Without `SENTRY_DSN` set, errors should NOT be sent to Sentry.

1. **Create a test API route** (`app/api/test-error/route.ts`):

```typescript
import { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/with-request-id'
import { asHttpError } from '@/lib/api/http'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  
  // Intentionally throw an error
  throw new Error('Test error for Sentry validation')
  
  return new Response('This should not be reached')
}
```

2. **Make request**:
```bash
curl http://localhost:3000/api/test-error
```

3. **Verify**:
   - ✅ Error is logged to console (check terminal)
   - ✅ Error response includes `requestId`
   - ✅ **No error sent to Sentry** (check Sentry dashboard - should be empty)

### Test 2: Error Capture Works When DSN is Set

**Expected Behavior**: With `SENTRY_DSN` set, errors SHOULD be sent to Sentry.

1. **Set DSN** in `.env.local`:
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

2. **Restart dev server**:
```bash
npm run dev
```

3. **Trigger error again**:
```bash
curl http://localhost:3000/api/test-error
```

4. **Verify**:
   - ✅ Error appears in Sentry dashboard (within 1-2 minutes)
   - ✅ Error includes `requestId` tag
   - ✅ Error includes route name (`/api/test-error`)
   - ✅ **No sensitive data** (check event details - no passwords, tokens, etc.)

### Test 3: Request ID Correlation

**Expected Behavior**: Request IDs should be included in error responses and Sentry events.

1. **Make request**:
```bash
curl -v http://localhost:3000/api/test-error
```

2. **Check response headers**:
```
X-Request-ID: 1704067200-a1b2c3d4
```

3. **Check response body**:
```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Test error for Sentry validation",
    "requestId": "1704067200-a1b2c3d4"
  }
}
```

4. **Check Sentry event** (if DSN is set):
   - Event should have `requestId` tag
   - Search for request ID in Sentry to find related events

### Test 4: PII Filtering

**Expected Behavior**: Sensitive data should NOT appear in Sentry events.

1. **Create test route** (`app/api/test-pii/route.ts`):

```typescript
import { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/with-request-id'
import { asHttpError } from '@/lib/api/http'
import { createCookieBridge } from '@/lib/api/http'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const bridge = createCookieBridge()
  
  try {
    const body = await request.json()
    
    // Intentionally include sensitive data in error
    throw new Error(`Login failed for ${body.email} with password: ${body.password}`)
  } catch (error) {
    return asHttpError(error, '/api/test-pii', undefined, bridge, requestId)
  }
}
```

2. **Make request with sensitive data**:
```bash
curl -X POST http://localhost:3000/api/test-pii \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret-token-123" \
  -d '{"email": "user@example.com", "password": "secret123"}'
```

3. **Check Sentry event** (if DSN is set):
   - ✅ Request body should be **empty** (not captured)
   - ✅ Authorization header should be **removed**
   - ✅ Email should **not** appear in event
   - ✅ Password should **not** appear in event
   - ✅ Only error message (sanitized) should appear

### Test 5: Request ID Persistence

**Expected Behavior**: Same request ID should be used throughout request lifecycle.

1. **Create test route** (`app/api/test-request-id/route.ts`):

```typescript
import { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/with-request-id'
import { ok } from '@/lib/api/http'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  
  // Request ID should be consistent
  const requestId2 = getRequestId(request)
  
  return ok({
    requestId,
    requestId2,
    match: requestId === requestId2,
  })
}
```

2. **Make request**:
```bash
curl http://localhost:3000/api/test-request-id
```

3. **Verify**:
   - ✅ `requestId` and `requestId2` should match
   - ✅ Response should include `X-Request-ID` header with same value

## Validation Checklist

- [ ] **Error capture is gated**: Errors NOT sent without DSN
- [ ] **Error capture works**: Errors sent when DSN is set
- [ ] **Request ID in response**: Error responses include `requestId`
- [ ] **Request ID in headers**: Response includes `X-Request-ID` header
- [ ] **Request ID in Sentry**: Sentry events include `requestId` tag
- [ ] **PII filtered**: Sensitive data not captured
- [ ] **Request ID persistent**: Same ID used throughout request
- [ ] **Console logging**: Errors still logged to console

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN**: Verify `SENTRY_DSN` is set correctly
2. **Check Environment**: Sentry only enabled if DSN is set
3. **Check Console**: Errors should still log to console
4. **Wait**: Sentry events may take 1-2 minutes to appear

### Request ID Missing

1. **Check Import**: Ensure `getRequestId()` is called
2. **Check Response**: Verify `requestId` is passed to error functions
3. **Check Headers**: Response should include `X-Request-ID`

### PII Still Appearing

1. **Check beforeSend**: Verify Sentry config filters sensitive data
2. **Check Request Body**: Should be empty in Sentry events
3. **Check Headers**: Sensitive headers should be removed

## Production Validation

After deploying to production:

1. **Monitor Sentry dashboard** for errors
2. **Verify request IDs** in error responses
3. **Check PII filtering** in production events
4. **Test alerts** by triggering a test error
5. **Verify performance monitoring** is working

## Next Steps

- Set up Sentry alerts (see `docs/OBSERVABILITY.md`)
- Create dashboards for monitoring
- Configure on-call notifications
- Review error trends weekly
