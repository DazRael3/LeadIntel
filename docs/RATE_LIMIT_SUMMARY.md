# Rate Limit Configuration Summary

## Exact Limits Per Route Category

### Where to Tune Limits

All rate limits are configured in: **`lib/api/ratelimit.ts`**

Edit the `RateLimitConfig` object to adjust limits:

```typescript
export const RateLimitConfig = {
  AUTH: { ... },
  AI_GENERATION: { ... },
  READ: { ... },
  WRITE: { ... },
  CHECKOUT: { ... },
}
```

## Route Categories and Limits

### 1. Auth Endpoints (`AUTH`)

**Routes**:
- `/api/auth/*` (if exists)
- `/api/verify-email`

**Current Limits**:
- Authenticated: **10 requests per minute**
- Unauthenticated: **5 requests per minute**

**Tuning**:
```typescript
AUTH: {
  authenticated: { limit: 10, window: '1 m' },  // Change 10 to adjust
  unauthenticated: { limit: 5, window: '1 m' }, // Change 5 to adjust
}
```

**Recommendation**: Keep strict to prevent brute force attacks. Consider increasing to 15/10 if legitimate users hit limits.

---

### 2. AI Generation Endpoints (`AI_GENERATION`)

**Routes**:
- `/api/generate-pitch` ✅ (applied)
- `/api/generate-sequence` ✅ (applied)
- `/api/generate-battle-card` ✅ (applied)
- `/api/generate-linkedin-comment`

**Current Limits**:
- Authenticated: **20 requests per hour**
- Unauthenticated: **3 requests per hour**

**Tuning**:
```typescript
AI_GENERATION: {
  authenticated: { limit: 20, window: '1 h' },  // Change 20 to adjust
  unauthenticated: { limit: 3, window: '1 h' }, // Change 3 to adjust
}
```

**Recommendation**: 
- If OpenAI costs are high, keep strict (20/hour)
- If users need more, increase to 30-50/hour for authenticated
- Consider Pro user tier with higher limits (future enhancement)

---

### 3. General Read Endpoints (`READ`)

**Routes**:
- `/api/history`
- `/api/history/export`
- `/api/tags` (GET)
- `/api/plan`
- `/api/whoami`

**Current Limits**:
- Authenticated: **100 requests per minute**
- Unauthenticated: **30 requests per minute**

**Tuning**:
```typescript
READ: {
  authenticated: { limit: 100, window: '1 m' },  // Change 100 to adjust
  unauthenticated: { limit: 30, window: '1 m' }, // Change 30 to adjust
}
```

**Recommendation**: These are lightweight operations. Current limits are generous. Only adjust if you see legitimate users hitting limits.

---

### 4. Write Endpoints (`WRITE`)

**Routes**:
- `/api/settings`
- `/api/tags` (POST)
- `/api/unlock-lead` ✅ (applied)
- `/api/leads/[leadId]/tags` (POST/DELETE)

**Current Limits**:
- Authenticated: **60 requests per minute**
- Unauthenticated: **10 requests per minute**

**Tuning**:
```typescript
WRITE: {
  authenticated: { limit: 60, window: '1 m' },  // Change 60 to adjust
  unauthenticated: { limit: 10, window: '1 m' }, // Change 10 to adjust
}
```

**Recommendation**: Moderate limits are appropriate. Adjust based on actual usage patterns.

---

### 5. Checkout Endpoint (`CHECKOUT`)

**Routes**:
- `/api/checkout` ✅ (applied)

**Current Limits**:
- Authenticated: **5 requests per hour**
- Unauthenticated: **1 request per hour**

**Tuning**:
```typescript
CHECKOUT: {
  authenticated: { limit: 5, window: '1 h' },  // Change 5 to adjust
  unauthenticated: { limit: 1, window: '1 h' }, // Change 1 to adjust
}
```

**Recommendation**: Very strict to prevent abuse. Users shouldn't need more than 5 checkout attempts per hour. Keep strict unless you have a legitimate use case.

---

## Routes with Rate Limiting Applied

✅ **Applied**:
- `/api/generate-pitch` (AI_GENERATION)
- `/api/generate-sequence` (AI_GENERATION)
- `/api/generate-battle-card` (AI_GENERATION)
- `/api/unlock-lead` (WRITE)
- `/api/checkout` (CHECKOUT)

## Routes with Bypass Logic

🔄 **Bypassed** (with conditions):
- `/api/stripe/webhook` - Bypasses if `stripe-signature` header present
- `/api/digest/run` - Bypasses if `x-admin-digest-secret` header matches env var

## Routes Not Yet Rate Limited

⚠️ **Not Applied** (can be added):
- `/api/settings` (should use WRITE)
- `/api/tags` (should use WRITE for POST, READ for GET)
- `/api/history` (should use READ)
- `/api/generate-linkedin-comment` (should use AI_GENERATION)
- Other routes as needed

## Quick Tuning Guide

### Increase Limits

1. Open `lib/api/ratelimit.ts`
2. Find the category (e.g., `AI_GENERATION`)
3. Increase the `limit` value
4. Save and redeploy

### Change Time Window

Change `window` string:
- `'1 s'` = 1 second
- `'1 m'` = 1 minute
- `'5 m'` = 5 minutes
- `'1 h'` = 1 hour
- `'1 d'` = 1 day

### Example: Make AI Generation More Permissive

```typescript
AI_GENERATION: {
  authenticated: { limit: 50, window: '1 h' },  // Increased from 20
  unauthenticated: { limit: 10, window: '1 h' }, // Increased from 3
},
```

### Example: Change Window to 5 Minutes

```typescript
AUTH: {
  authenticated: { limit: 10, window: '5 m' },  // Changed from '1 m'
  unauthenticated: { limit: 5, window: '5 m' },
},
```

## Monitoring

### Check Rate Limit Usage

1. **Upstash Dashboard**: View Redis keys matching `@leadintel/ratelimit/*`
2. **Application Logs**: Check for rate limit errors
3. **User Reports**: Monitor support tickets for rate limit complaints

### Adjust Based on Data

- **High error rate**: Increase limits
- **Low usage**: Can decrease limits to save costs
- **Spike in abuse**: Decrease limits or add additional protections

## Environment Variables

Required for rate limiting to work:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

**Note**: If not configured, rate limiting is disabled (graceful degradation).

## Testing Rate Limits

1. **Manual Testing**: Make requests until you hit the limit
2. **Automated Tests**: Run `lib/api/ratelimit.test.ts`
3. **Load Testing**: Use tools like `k6` or `artillery` to test limits

## Production Checklist

- [ ] Upstash Redis configured
- [ ] Rate limits tested in staging
- [ ] Monitoring alerts set up
- [ ] Documentation updated with actual limits
- [ ] Support team aware of rate limit behavior
- [ ] Error messages are user-friendly
