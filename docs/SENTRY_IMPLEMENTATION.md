# Sentry Error Tracking Implementation

## Summary

Production-ready error tracking and request correlation has been implemented using Sentry for Next.js.

## Files Created/Modified

### New Files

1. **`lib/observability/request-id.ts`**
   - Request ID generation and correlation utilities
   - `generateRequestId()` - Creates unique request IDs
   - `getOrCreateRequestId()` - Gets existing or creates new request ID
   - `setRequestIdHeader()` - Sets request ID in response headers

2. **`lib/observability/sentry.ts`**
   - Sentry initialization and utilities
   - `initSentry()` - Initializes Sentry with PII filtering
   - `captureException()` - Captures errors with context
   - `captureMessage()` - Captures messages with context
   - `setRequestId()` - Sets request ID in Sentry scope

3. **`lib/api/with-request-id.ts`**
   - Helper to get request ID in API routes
   - `getRequestId()` - Gets or creates request ID and sets in Sentry

4. **`sentry.client.config.ts`**
   - Client-side Sentry configuration
   - Automatically loaded by @sentry/nextjs

5. **`sentry.server.config.ts`**
   - Server-side Sentry configuration
   - Automatically loaded by @sentry/nextjs

6. **`sentry.edge.config.ts`**
   - Edge runtime Sentry configuration (middleware)
   - Automatically loaded by @sentry/nextjs

7. **`instrumentation.ts`**
   - Next.js instrumentation hook
   - Initializes Sentry on server startup

8. **`app/api/test-error/route.ts`**
   - Test endpoint for validating Sentry (dev only)

9. **`docs/OBSERVABILITY.md`**
   - Complete observability documentation

10. **`docs/VALIDATE_SENTRY.md`**
    - Local validation guide

### Modified Files

1. **`lib/env.ts`**
   - Added Sentry environment variables to schema:
     - `SENTRY_DSN`
     - `SENTRY_ENVIRONMENT`
     - `SENTRY_TRACES_SAMPLE_RATE`

2. **`lib/api/http.ts`**
   - Updated `fail()` to accept `requestId` parameter
   - Updated `asHttpError()` to accept `requestId` parameter
   - Updated `ok()` to accept `requestId` parameter
   - Updated `logError()` to send errors to Sentry
   - Added `REQUEST_ID_HEADER` export
   - Error responses now include `requestId` in error object
   - Response headers include `X-Request-ID`

3. **`lib/api/validate.ts`**
   - Updated `validationError()` to accept `requestId` parameter

4. **`lib/api/ratelimit.ts`**
   - Updated `getRateLimitError()` to accept `requestId` parameter

5. **`middleware.ts`**
   - Added request ID generation and correlation
   - Sets request ID in Sentry scope
   - Adds `X-Request-ID` header to all responses

6. **`next.config.js`**
   - Wrapped with `withSentryConfig()` when DSN is configured
   - Disables Sentry webpack plugins when DSN is not set

7. **`app/api/generate-pitch/route.ts`**
   - Example implementation with request ID
   - Uses `getRequestId()` at start of handler
   - Passes `requestId` to all error functions

## Environment Variables

Add to `.env.local` or production:

```bash
# Server-side Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Client-side Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Request Correlation

### Request ID Format

- Format: `timestamp-hexrandom` (e.g., `1704067200-a1b2c3d4`)
- Generated if `X-Request-ID` header is missing
- Included in all error responses as `error.requestId`
- Included in response headers as `X-Request-ID`
- Attached to Sentry events as `requestId` tag

### Usage in API Routes

```typescript
import { getRequestId } from '@/lib/api/with-request-id'
import { fail, asHttpError } from '@/lib/api/http'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  
  try {
    // ... your code
  } catch (error) {
    return asHttpError(error, '/api/example', user?.id, bridge, requestId)
  }
}
```

## Error Response Format

All error responses now include `requestId`:

```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "1704067200-a1b2c3d4"
  }
}
```

Response headers also include:
```
X-Request-ID: 1704067200-a1b2c3d4
```

## PII and Secret Protection

Sentry automatically filters:

- ✅ Request bodies (removed entirely)
- ✅ Sensitive headers (`authorization`, `cookie`, `x-api-key`, `stripe-signature`)
- ✅ User email/name (only user ID kept)
- ✅ Sensitive tags (email, password, token)
- ✅ Environment variables (never captured)

## How to Validate Locally

### 1. Test Error Capture is Gated (No DSN)

**Expected**: Errors should NOT be sent to Sentry.

1. **Ensure `SENTRY_DSN` is NOT set** in `.env.local`
2. **Start dev server**: `npm run dev`
3. **Trigger test error**:
   ```bash
   curl http://localhost:3000/api/test-error
   ```
4. **Verify**:
   - ✅ Error logged to console
   - ✅ Error response includes `requestId`
   - ✅ **No error sent to Sentry** (check Sentry dashboard)

### 2. Test Error Capture Works (With DSN)

**Expected**: Errors SHOULD be sent to Sentry.

1. **Set DSN** in `.env.local`:
   ```bash
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```
2. **Restart dev server**: `npm run dev`
3. **Trigger test error**:
   ```bash
   curl http://localhost:3000/api/test-error
   ```
4. **Verify**:
   - ✅ Error appears in Sentry dashboard (within 1-2 minutes)
   - ✅ Error includes `requestId` tag
   - ✅ Error includes route name (`/api/test-error`)
   - ✅ **No sensitive data** in event

### 3. Test Request ID

1. **Make API request**:
   ```bash
   curl -v http://localhost:3000/api/generate-pitch \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"companyUrl": "https://example.com"}'
   ```

2. **Check response headers**:
   ```
   X-Request-ID: 1704067200-a1b2c3d4
   ```

3. **Check error response** (if error occurs):
   ```json
   {
     "ok": false,
     "error": {
       "requestId": "1704067200-a1b2c3d4"
     }
   }
   ```

### 4. Test PII Filtering

1. **Trigger error with sensitive data**:
   ```bash
   curl -X POST http://localhost:3000/api/test-error \
     -H "Authorization: Bearer secret-token-123" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "secret123"}'
   ```

2. **Check Sentry event**:
   - ✅ Request body should be **empty**
   - ✅ Authorization header should be **removed**
   - ✅ Email/password should **not** appear

## Next Steps

1. **Get Sentry DSN**: Sign up at https://sentry.io and create a Next.js project
2. **Configure Production**: Add `SENTRY_DSN` to production environment
3. **Set Up Alerts**: Configure alerts in Sentry dashboard (see `docs/OBSERVABILITY.md`)
4. **Create Dashboards**: Set up monitoring dashboards (see `docs/OBSERVABILITY.md`)
5. **Update Routes**: Add `getRequestId()` to other API routes (optional, but recommended)

## Acceptance Criteria

- [x] Sentry integrated for Next.js (server + client)
- [x] Environment-based enabling (only when DSN is set)
- [x] Request ID generation and correlation
- [x] Request ID in error responses (`error.requestId`)
- [x] Request ID in response headers (`X-Request-ID`)
- [x] PII/secrets not captured
- [x] Standardized API envelope includes requestId
- [x] Ops doc with dashboards/alerts suggestions
- [x] Local validation guide

## Dependencies

- `@sentry/nextjs` - Installed via `npm install @sentry/nextjs`

For detailed documentation, see:
- `docs/OBSERVABILITY.md` - Complete observability guide
- `docs/VALIDATE_SENTRY.md` - Local validation guide
