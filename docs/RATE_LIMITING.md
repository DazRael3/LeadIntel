# Rate Limiting Configuration

This document describes the rate limiting implementation using Upstash Redis.

## Overview

Rate limiting is implemented using [Upstash Redis](https://upstash.com/) and [@upstash/ratelimit](https://github.com/upstash/ratelimit) to protect API endpoints from abuse and control costs.

## Key Strategy

Rate limits are keyed by:
- **Authenticated users**: `user:{userId}:{route}`
- **Unauthenticated users**: `ip:{clientIp}:{route}`

This ensures:
- Authenticated users have separate limits per user
- Unauthenticated users are limited by IP address
- Each route has independent rate limits

## Rate Limit Categories

### 1. Auth Endpoints (`AUTH`)
**Routes**: `/api/auth/*`, `/api/verify-email`

| User Type | Limit | Window |
|-----------|-------|--------|
| Authenticated | 10 requests | 1 minute |
| Unauthenticated | 5 requests | 1 minute |

**Rationale**: Stricter limits to prevent brute force attacks on authentication endpoints.

### 2. AI Generation Endpoints (`AI_GENERATION`)
**Routes**: 
- `/api/generate-pitch`
- `/api/generate-sequence`
- `/api/generate-battle-card`
- `/api/generate-linkedin-comment`

| User Type | Limit | Window |
|-----------|-------|--------|
| Authenticated | 20 requests | 1 hour |
| Unauthenticated | 3 requests | 1 hour |

**Rationale**: Stricter limits due to OpenAI API costs. These endpoints consume significant resources.

### 3. General Read Endpoints (`READ`)
**Routes**: 
- `/api/history`
- `/api/tags` (GET)
- `/api/plan`
- `/api/whoami`

| User Type | Limit | Window |
|-----------|-------|--------|
| Authenticated | 100 requests | 1 minute |
| Unauthenticated | 30 requests | 1 minute |

**Rationale**: Looser limits for normal usage patterns. Read operations are lightweight.

### 4. Write Endpoints (`WRITE`)
**Routes**: 
- `/api/settings`
- `/api/tags` (POST)
- `/api/unlock-lead`
- `/api/leads/[leadId]/tags`

| User Type | Limit | Window |
|-----------|-------|--------|
| Authenticated | 60 requests | 1 minute |
| Unauthenticated | 10 requests | 1 minute |

**Rationale**: Moderate limits for write operations that may have database impact.

### 5. Checkout Endpoint (`CHECKOUT`)
**Routes**: `/api/checkout`

| User Type | Limit | Window |
|-----------|-------|--------|
| Authenticated | 5 requests | 1 hour |
| Unauthenticated | 1 request | 1 hour |

**Rationale**: Very strict limits to prevent abuse of checkout flow and Stripe API calls.

## Bypass Logic

Certain routes bypass rate limiting for legitimate use cases:

### 1. Stripe Webhook (`/api/stripe/webhook`)
- **Bypass condition**: Request includes `stripe-signature` header
- **Rationale**: Stripe webhooks are verified by signature first, then bypass rate limiting
- **Security**: Signature verification happens before rate limit check

### 2. Admin Digest Cron (`/api/digest/run`)
- **Bypass condition**: Request includes `x-admin-digest-secret` header matching `ADMIN_DIGEST_SECRET` env var
- **Rationale**: Internal cron jobs should not be rate limited
- **Security**: Secret must match environment variable

## Error Response Format

When rate limit is exceeded, the API returns:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 20,
      "remaining": 0,
      "reset": "2024-01-01T12:00:00.000Z",
      "retryAfter": 3600
    }
  }
}
```

**HTTP Status**: `429 Too Many Requests`

**Headers**:
- `Retry-After`: Seconds until rate limit resets
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Getting Upstash Credentials

1. Sign up at [Upstash](https://upstash.com/)
2. Create a Redis database
3. Copy the REST URL and REST Token from the database dashboard

### Fallback Behavior

If Upstash credentials are not configured:
- Rate limiting is **disabled** (returns `null`)
- Warning logged in development mode
- No errors thrown (graceful degradation)

This allows the app to run without rate limiting in development, but production should always have Upstash configured.

## Tuning Rate Limits

Rate limits are configured in `lib/api/ratelimit.ts`:

```typescript
export const RateLimitConfig = {
  AUTH: {
    authenticated: { limit: 10, window: '1 m' },
    unauthenticated: { limit: 5, window: '1 m' },
  },
  AI_GENERATION: {
    authenticated: { limit: 20, window: '1 h' },
    unauthenticated: { limit: 3, window: '1 h' },
  },
  // ... etc
}
```

### Adjusting Limits

1. **Increase limits**: Change `limit` value (e.g., `20` → `30`)
2. **Change window**: Change `window` string (e.g., `'1 m'` → `'5 m'`)
3. **Window formats**: `'1 s'`, `'1 m'`, `'1 h'`, `'1 d'`

### Example: Increase AI Generation Limit

```typescript
AI_GENERATION: {
  authenticated: { limit: 30, window: '1 h' }, // Increased from 20
  unauthenticated: { limit: 5, window: '1 h' }, // Increased from 3
},
```

### Example: Change Window to 5 Minutes

```typescript
AUTH: {
  authenticated: { limit: 10, window: '5 m' }, // Changed from '1 m'
  unauthenticated: { limit: 5, window: '5 m' },
},
```

## Testing

Run rate limiting tests:

```bash
node --test lib/api/ratelimit.test.ts
# or
npx tsx lib/api/ratelimit.test.ts
```

Tests cover:
- IP extraction from headers
- Bypass logic for Stripe webhooks
- Bypass logic for admin cron
- Rate limit configuration validation
- Error response formatting

## Monitoring

### Upstash Dashboard

Monitor rate limiting in the Upstash dashboard:
1. Go to your Redis database
2. View metrics for key patterns: `@leadintel/ratelimit/*`
3. Check request counts and hit rates

### Application Logs

Rate limit errors are logged with:
- Route path
- User ID or IP
- Rate limit category
- Remaining requests

## Production Considerations

1. **Always configure Upstash**: Rate limiting should be enabled in production
2. **Monitor limits**: Adjust based on actual usage patterns
3. **Alert on spikes**: Set up alerts for unusual rate limit activity
4. **Consider Pro users**: May want higher limits for Pro subscribers (future enhancement)

## Future Enhancements

Potential improvements:
- Different limits for Pro vs Free users
- Per-user custom limits (admin override)
- Rate limit analytics dashboard
- Automatic limit adjustment based on usage patterns
- IP allowlist for trusted sources
