# Security Headers and CORS Configuration

This document describes the security headers and origin validation implementation.

## Overview

Security headers are applied globally via middleware, and origin validation is enforced on state-changing API endpoints to prevent CSRF attacks.

## Security Headers

All security headers are applied in **`middleware.ts`** using the `applySecurityHeaders()` function from `lib/api/security.ts`.

### Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `X-Frame-Options` | `DENY` | Prevents clickjacking (legacy support) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Restricts browser features |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HSTS (HTTPS only, production only) |
| `Content-Security-Policy` | See below | Prevents XSS and injection attacks |

### Content Security Policy (CSP)

Baseline CSP applied globally:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.openai.com https://*.upstash.io;
frame-ancestors 'none';
```

**Note**: CSP is relaxed for Next.js compatibility (allows inline scripts/styles). For stricter security, consider:
- Using nonce-based CSP
- Customizing CSP per route
- Removing `'unsafe-inline'` and `'unsafe-eval'` if possible

### HSTS (HTTP Strict Transport Security)

- **Only applied in production**
- **Only for HTTPS requests**
- **Max age**: 1 year (31536000 seconds)
- **Includes subdomains**: Yes
- **Preload**: Enabled

## Origin Validation

Origin validation is enforced on **state-changing endpoints** (POST, PUT, DELETE, PATCH) to prevent CSRF attacks.

### Implementation Location

Origin validation is implemented in:
- **`lib/api/security.ts`** - `validateOrigin()` function
- **Applied per-route** in state-changing API handlers

### Routes with Origin Validation

✅ **Applied**:
- `/api/generate-pitch` (POST)
- `/api/generate-sequence` (POST)
- `/api/generate-battle-card` (POST)
- `/api/unlock-lead` (POST)
- `/api/checkout` (POST)
- `/api/settings` (POST)

### Routes Bypassing Origin Validation

🔄 **Bypassed**:
- `/api/stripe/webhook` - Uses Stripe signature verification instead
- All GET/HEAD/OPTIONS requests - Read-only, no CSRF risk

### Configuration

Set allowed origins in `.env.local`:

```bash
# Single origin
ALLOWED_ORIGINS=https://app.example.com

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com

# Wildcard subdomains (e.g., *.example.com)
ALLOWED_ORIGINS=https://*.example.com
```

**Default behavior**:
- If `ALLOWED_ORIGINS` is not set, uses `NEXT_PUBLIC_SITE_URL` if available
- In development, allows `http://localhost:3000` and `http://127.0.0.1:3000`
- In development, allows requests without Origin header (for testing tools)

### Origin Validation Logic

1. **Skip validation** for:
   - Stripe webhook route (uses signature verification)
   - GET/HEAD/OPTIONS requests (read-only)
   - Development mode (if no origin provided)

2. **Extract origin** from:
   - `Origin` header (preferred)
   - `Referer` header (fallback)

3. **Validate against**:
   - `ALLOWED_ORIGINS` env var (comma-separated)
   - `NEXT_PUBLIC_SITE_URL` env var
   - Development localhost origins

4. **Support wildcards**:
   - `*.example.com` matches `app.example.com`, `www.example.com`, etc.

### Error Response

If origin validation fails:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Origin not allowed",
    "details": {
      "origin": "https://malicious.com",
      "allowedOrigins": ["https://app.example.com"],
      "hint": "Request origin does not match allowed origins"
    }
  }
}
```

**HTTP Status**: `403 Forbidden`

## Implementation Details

### Where Headers Are Applied

1. **Global Headers** (`middleware.ts`):
   - All responses get security headers via `applySecurityHeaders()`
   - Applied after Supabase session update
   - Works for all routes (API, pages, assets)

2. **Origin Validation** (`lib/api/security.ts`):
   - Per-route validation in API handlers
   - Called before business logic
   - Returns error response if validation fails

### Next.js Compatibility

Security headers are designed to work with:
- ✅ Next.js App Router
- ✅ Supabase auth cookies (headers don't interfere)
- ✅ Next.js static assets (`_next/static`, `_next/image`)
- ✅ API routes
- ✅ Server Components

### Supabase Cookie Flows

Security headers **do not interfere** with Supabase auth:
- Headers are applied to responses, not requests
- Cookie handling happens in middleware before headers are applied
- No CORS restrictions on cookies (same-origin requests)

## Testing

### Test Origin Validation

```bash
# Valid origin (if configured)
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

### Test Security Headers

```bash
# Check headers on any response
curl -I https://your-app.com/

# Should see:
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Content-Security-Policy: ...
```

## Production Checklist

- [ ] `ALLOWED_ORIGINS` configured with production domains
- [ ] `NEXT_PUBLIC_SITE_URL` set to production URL
- [ ] HTTPS enabled (required for HSTS)
- [ ] Security headers verified in production
- [ ] Origin validation tested for all state-changing endpoints
- [ ] CSP customized if needed (currently relaxed for Next.js)

## Customization

### Adjust CSP

Edit `lib/api/security.ts` → `getSecurityHeaders()`:

```typescript
const csp = [
  "default-src 'self'",
  // Add your custom directives
  "script-src 'self' 'unsafe-inline' https://trusted-cdn.com",
  // ...
].join('; ')
```

### Add More Allowed Origins

Set `ALLOWED_ORIGINS` env var with comma-separated list:

```bash
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://*.example.com
```

### Disable Origin Validation for a Route

In the route handler, skip validation:

```typescript
// Skip origin validation (not recommended unless necessary)
// const originError = validateOrigin(request, route)
// if (originError) {
//   return originError
// }
```

## Troubleshooting

### "Origin not allowed" errors

1. Check `ALLOWED_ORIGINS` env var is set correctly
2. Verify origin matches exactly (including protocol, domain, port)
3. In development, ensure localhost origins are allowed

### CSP blocking scripts/styles

1. Check browser console for CSP violations
2. Adjust CSP in `lib/api/security.ts` if needed
3. Consider using nonce-based CSP for stricter security

### Headers not appearing

1. Verify middleware is running (check `middleware.ts`)
2. Check that `applySecurityHeaders()` is called
3. Ensure headers aren't being overridden elsewhere
