# API Response Standardization Implementation

**Date**: January 2025  
**Task**: Standardize all API responses and errors across Next.js route handlers

---

## Summary

Implemented comprehensive API response standardization using centralized HTTP utilities. All route handlers now use consistent response formats, proper error handling, and structured logging without exposing secrets or stack traces.

---

## Files Created

### 1. `lib/api/http.ts`

**Purpose**: Centralized HTTP response utilities

**Exports**:
- `ok(data, init?, cookieBridge?)` - Success responses: `{ ok: true, data }`
- `fail(code, message, details?, init?, cookieBridge?)` - Error responses: `{ ok: false, error: { code, message, details? } }`
- `asHttpError(error, route?, userId?, cookieBridge?)` - Converts errors to standardized format
- `createCookieBridge()` - Helper for Supabase cookie bridging
- `ErrorCode` - Standardized error codes
- `HttpStatus` - HTTP status code constants

**Features**:
- ✅ Never exposes stack traces to clients
- ✅ Structured logging (no secrets)
- ✅ Handles Zod, Supabase auth, and generic errors
- ✅ Automatic HTTP status code mapping
- ✅ Cookie bridge support for Supabase auth

---

## Files Updated

### Core Routes (25 API routes updated)

1. ✅ `app/api/whoami/route.ts` - GET
2. ✅ `app/api/plan/route.ts` - GET
3. ✅ `app/api/settings/route.ts` - POST
4. ✅ `app/api/checkout/route.ts` - POST
5. ✅ `app/api/generate-pitch/route.ts` - POST
6. ✅ `app/api/send-pitch/route.ts` - POST
7. ✅ `app/api/unlock-lead/route.ts` - POST
8. ✅ `app/api/history/route.ts` - GET
9. ✅ `app/api/history/export/route.ts` - GET
10. ✅ `app/api/tags/route.ts` - GET, POST, DELETE
11. ✅ `app/api/reveal/route.ts` - POST
12. ✅ `app/api/tracker/route.ts` - GET, POST
13. ✅ `app/api/generate-battle-card/route.ts` - POST
14. ✅ `app/api/generate-sequence/route.ts` - POST
15. ✅ `app/api/generate-linkedin-comment/route.ts` - POST
16. ✅ `app/api/verify-email/route.ts` - POST
17. ✅ `app/api/push-to-crm/route.ts` - POST
18. ✅ `app/api/stripe/portal/route.ts` - POST
19. ✅ `app/api/stripe/webhook/route.ts` - POST (special case: Stripe format)
20. ✅ `app/api/stripe/checkout/route.ts` - GET (deprecated)
21. ✅ `app/api/leads/[leadId]/tags/route.ts` - POST, DELETE
22. ✅ `app/api/digest/run/route.ts` - POST
23. ✅ `app/api/digest/test/route.ts` - POST
24. ✅ `app/api/dev/create-user/route.ts` - POST
25. ✅ `app/api/webhook/route.ts` - POST (deprecated)

**Total**: 25 routes updated

**Note**: `app/api/stripe/webhook/route.ts` uses `NextResponse.json({ received: true })` for the success case because Stripe webhooks require this specific format. Error cases use standardized format.

---

## Response Format Standardization

### Success Response Format

**Before** (inconsistent):
```json
// Various formats
{ "plan": "pro" }
{ "ok": true, "settings": {...} }
{ "success": true, "message": "..." }
{ "items": [...], "nextCursor": "..." }
```

**After** (standardized):
```json
{
  "ok": true,
  "data": {
    // Response payload
  }
}
```

### Error Response Format

**Before** (inconsistent):
```json
// Various formats
{ "error": "Unauthorized" }
{ "ok": false, "error": "..." }
{ "error": "message", "details": {...} }
```

**After** (standardized):
```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "details": { /* optional */ }
  }
}
```

---

## Before/After Example

### Example: `/api/plan` Route

#### Before

```typescript
export async function GET(request: NextRequest) {
  const bridge = NextResponse.next()
  const supabase = createRouteClient(request, bridge)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return jsonWithCookies({ error: 'Unauthorized' }, { status: 401 }, bridge)
  }

  try {
    const plan = await getPlan(supabase as any, user.id)
    return jsonWithCookies({ plan }, { status: 200 }, bridge)
  } catch (error: any) {
    console.error('[plan] failed to resolve plan', error)
    return jsonWithCookies({ error: error.message || 'Failed to resolve plan' }, { status: 500 }, bridge)
  }
}
```

**Response Examples**:
- Success: `{ "plan": "pro" }` (status 200)
- Error: `{ "error": "Unauthorized" }` (status 401)
- Error: `{ "error": "Failed to resolve plan" }` (status 500)

#### After

```typescript
export async function GET(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    const supabase = createRouteClient(request, bridge)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const plan = await getPlan(supabase as any, user.id)
    return ok({ plan }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge)
  }
}
```

**Response Examples**:
- Success: 
  ```json
  {
    "ok": true,
    "data": {
      "plan": "pro"
    }
  }
  ```
  (status 200)

- Error (Unauthorized):
  ```json
  {
    "ok": false,
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Authentication required"
    }
  }
  ```
  (status 401)

- Error (Internal):
  ```json
  {
    "ok": false,
    "error": {
      "code": "INTERNAL_ERROR",
      "message": "An unexpected error occurred"
    }
  }
  ```
  (status 500)

**Key Improvements**:
1. ✅ Consistent `{ ok: true/false }` format
2. ✅ Structured error with `code` and `message`
3. ✅ No stack traces exposed
4. ✅ Structured logging (route name, user ID)
5. ✅ Automatic error type detection (Zod, auth, etc.)

---

## Error Code Standards

### Standardized Error Codes

| Code | HTTP Status | Use Case |
|------|-------------|----------|
| `VALIDATION_ERROR` | 400 | Input validation failures (Zod, manual checks) |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Authenticated but not permitted (e.g., Pro feature) |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., already subscribed) |
| `UNPROCESSABLE_ENTITY` | 422 | Business logic validation errors |
| `SCHEMA_MIGRATION_REQUIRED` | 424 | Database schema migration needed |
| `DATABASE_ERROR` | 500 | Database operation failures |
| `EXTERNAL_API_ERROR` | 500 | Third-party API failures |
| `INTERNAL_ERROR` | 500 | Generic server errors |

---

## Security Improvements

### 1. No Stack Traces

**Before**:
```typescript
catch (error: any) {
  return NextResponse.json({ error: error.message }, { status: 500 })
  // Could expose stack traces if error.message contains them
}
```

**After**:
```typescript
catch (error) {
  return asHttpError(error, '/api/route', userId, bridge)
  // Never exposes stack traces - only safe error messages
}
```

### 2. Structured Logging (No Secrets)

**Before**:
```typescript
console.error('Error:', error) // May log secrets
console.log('Request:', body) // May log PII
```

**After**:
```typescript
// In asHttpError() - structured logging
console.error('[route-name] ErrorName:', {
  message: errorMessage,
  code: errorCode,
  userId: userId,
  // Never includes: stack traces, request bodies, tokens, keys, passwords
})
```

### 3. Error Type Detection

The `asHttpError()` function automatically detects:
- **Zod validation errors** → `VALIDATION_ERROR` with formatted details
- **Supabase auth errors** → `UNAUTHORIZED`
- **Database schema errors** → `SCHEMA_MIGRATION_REQUIRED` with helpful hints
- **Generic errors** → `INTERNAL_ERROR` with safe message

---

## Migration Pattern

### Standard Pattern Applied

```typescript
// 1. Import utilities
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'

// 2. Create cookie bridge (if needed)
const bridge = createCookieBridge()

// 3. Wrap in try/catch
try {
  // 4. Authentication check
  if (!user) {
    return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
  }

  // 5. Validation
  if (!requiredField) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Field required', undefined, undefined, bridge)
  }

  // 6. Business logic
  const result = await doSomething()

  // 7. Success response
  return ok(result, undefined, bridge)
} catch (error) {
  // 8. Error handling
  return asHttpError(error, '/api/route', userId, bridge)
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Success responses return `{ ok: true, data: {...} }`
- [ ] Error responses return `{ ok: false, error: { code, message } }`
- [ ] No stack traces in error responses
- [ ] HTTP status codes are correct (401 for auth, 400 for validation, etc.)
- [ ] Cookie bridging works (Supabase auth cookies forwarded)
- [ ] Structured logging appears in console (no secrets)

### Example Test Cases

**Test 1: Unauthenticated Request**
```bash
curl http://localhost:3000/api/plan
```
**Expected**: 
```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```
**Status**: 401

**Test 2: Successful Request**
```bash
curl -H "Cookie: ..." http://localhost:3000/api/plan
```
**Expected**:
```json
{
  "ok": true,
  "data": {
    "plan": "pro"
  }
}
```
**Status**: 200

**Test 3: Validation Error**
```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected**:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "display_name and from_email are required"
  }
}
```
**Status**: 400

---

## Acceptance Criteria

- [x] `lib/api/http.ts` created with `ok()`, `fail()`, `asHttpError()`
- [x] All API routes updated to use standardized helpers
- [x] No stack traces exposed to clients
- [x] Structured logging implemented (no secrets)
- [x] Consistent response format: `{ ok: true/false, data/error }`
- [x] Error codes standardized
- [x] HTTP status codes mapped correctly
- [x] Cookie bridging preserved for Supabase auth
- [x] Before/after example provided
- [x] All routes listed

---

## Files Summary

### Created
- `lib/api/http.ts` - Standardized HTTP utilities

### Updated (25 routes)
- All routes in `app/api/` directory

### Documentation
- `docs/API_RESPONSE_STANDARDIZATION.md` - This file

---

## Next Steps

1. ✅ Core implementation complete
2. ⚠️ Client-side code may need updates to handle new response format
3. ⚠️ Add integration tests for standardized responses
4. ⚠️ Update API documentation with new response formats

---

**Status**: ✅ Complete - All API routes standardized
