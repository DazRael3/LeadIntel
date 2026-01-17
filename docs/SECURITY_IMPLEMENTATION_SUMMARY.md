# Security Headers and CORS Implementation Summary

## Final Headers Applied

### Security Headers (Global - via Middleware)

All headers are applied in **`middleware.ts`** using `applySecurityHeaders()` from `lib/api/security.ts`.

| Header | Value | Implementation Location |
|--------|-------|------------------------|
| `X-Content-Type-Options` | `nosniff` | `middleware.ts` → `applySecurityHeaders()` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `middleware.ts` → `applySecurityHeaders()` |
| `X-Frame-Options` | `DENY` | `middleware.ts` → `applySecurityHeaders()` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | `middleware.ts` → `applySecurityHeaders()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | `middleware.ts` → `applySecurityHeaders()` (production, HTTPS only) |
| `Content-Security-Policy` | See CSP section below | `middleware.ts` → `applySecurityHeaders()` |

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.openai.com https://*.upstash.io;
frame-ancestors 'none';
```

**Implementation**: `lib/api/security.ts` → `getSecurityHeaders()`

## Origin Validation

### Implementation Location

- **Utility**: `lib/api/security.ts` → `validateOrigin()`
- **Applied per-route** in state-changing API handlers

### Routes with Origin Validation

| Route | Method | Implementation |
|-------|--------|----------------|
| `/api/generate-pitch` | POST | `app/api/generate-pitch/route.ts` |
| `/api/generate-sequence` | POST | `app/api/generate-sequence/route.ts` |
| `/api/generate-battle-card` | POST | `app/api/generate-battle-card/route.ts` |
| `/api/unlock-lead` | POST | `app/api/unlock-lead/route.ts` |
| `/api/checkout` | POST | `app/api/checkout/route.ts` |
| `/api/settings` | POST | `app/api/settings/route.ts` |

### Routes Bypassing Origin Validation

| Route | Reason |
|-------|--------|
| `/api/stripe/webhook` | Uses Stripe signature verification |
| All GET/HEAD/OPTIONS | Read-only, no CSRF risk |

## Implementation Architecture

### 1. Middleware (`middleware.ts`)

**Purpose**: Apply security headers globally to all responses

**Flow**:
1. Update Supabase session (cookie handling)
2. Apply security headers via `applySecurityHeaders()`
3. Return response with headers

**Code**:
```typescript
export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  return applySecurityHeaders(response, request)
}
```

### 2. Security Utilities (`lib/api/security.ts`)

**Functions**:
- `validateOrigin()` - Validates request origin for state-changing endpoints
- `getSecurityHeaders()` - Returns security headers object
- `applySecurityHeaders()` - Applies headers to NextResponse

**Configuration**:
- Reads `ALLOWED_ORIGINS` from env (comma-separated)
- Falls back to `NEXT_PUBLIC_SITE_URL`
- Allows localhost in development

### 3. Route-Level Origin Validation

**Pattern**:
```typescript
export async function POST(request: NextRequest) {
  // Validate origin first
  const originError = validateOrigin(request, route)
  if (originError) {
    return originError
  }
  
  // Continue with business logic...
}
```

**Applied to**: All state-changing endpoints (POST, PUT, DELETE, PATCH)

## Environment Variables

### Required

```bash
# Site URL (used as default allowed origin)
NEXT_PUBLIC_SITE_URL=https://app.example.com
```

### Optional

```bash
# Allowed origins (comma-separated, overrides NEXT_PUBLIC_SITE_URL)
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com,https://*.example.com
```

## File Locations

| Component | File | Purpose |
|-----------|------|---------|
| **Security Headers** | `middleware.ts` | Applies headers globally |
| **Security Utilities** | `lib/api/security.ts` | Origin validation & header generation |
| **Security Wrapper** | `lib/api/with-security.ts` | Optional helper for route wrapping |
| **Environment Config** | `lib/env.ts` | `ALLOWED_ORIGINS` schema |
| **Documentation** | `docs/SECURITY_HEADERS.md` | Full documentation |

## Next.js Compatibility

✅ **Verified Compatible**:
- Next.js App Router
- Supabase auth cookies (headers don't interfere)
- Next.js static assets (`_next/static`, `_next/image`)
- API routes
- Server Components
- Client Components

**CSP Configuration**:
- Allows `'unsafe-inline'` for Next.js scripts/styles
- Allows `'unsafe-eval'` for Next.js development
- Can be tightened in production if needed

## Testing

### Verify Headers

```bash
# Check headers on any route
curl -I https://your-app.com/

# Should see all security headers
```

### Test Origin Validation

```bash
# Valid origin
curl -X POST https://your-app.com/api/generate-pitch \
  -H "Origin: https://app.example.com" \
  -H "Content-Type: application/json" \
  -d '{"companyUrl": "https://example.com"}'

# Invalid origin (should return 403)
curl -X POST https://your-app.com/api/generate-pitch \
  -H "Origin: https://malicious.com" \
  -H "Content-Type: application/json" \
  -d '{"companyUrl": "https://example.com"}'
```

## Production Deployment

1. **Set environment variables**:
   ```bash
   NEXT_PUBLIC_SITE_URL=https://app.example.com
   ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
   ```

2. **Verify HTTPS**: HSTS only works with HTTPS

3. **Test headers**: Use browser dev tools or curl to verify

4. **Monitor CSP violations**: Check browser console for CSP errors

## Summary

- ✅ **Security headers**: Applied globally via middleware
- ✅ **Origin validation**: Applied per-route for state-changing endpoints
- ✅ **Stripe webhook**: Bypasses origin validation (uses signature)
- ✅ **Supabase cookies**: Fully functional (headers don't interfere)
- ✅ **Next.js assets**: Compatible (CSP allows Next.js requirements)
- ✅ **Production-ready**: HSTS, strict validation in production

All security measures are production-safe and don't break existing functionality.
