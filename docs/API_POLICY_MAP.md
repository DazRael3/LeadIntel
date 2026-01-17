# API Policy Map - Final Implementation

## Policy Tiers

### Tier A: AI/Cost-Heavy
- **Rate Limits**: 10/min per user, 5/min per IP
- **Max Bytes**: 65536 (64KB)
- **Routes**:
  - `POST:/api/generate-pitch`
  - `POST:/api/generate-sequence`
  - `POST:/api/generate-battle-card`
  - `POST:/api/generate-linkedin-comment`
  - `POST:/api/reveal`
  - `POST:/api/unlock-lead`
  - `POST:/api/send-pitch`

### Tier B: Payments
- **Rate Limits**: 10/min per user, 5/min per IP
- **Max Bytes**: 32768 (32KB)
- **Routes**:
  - `POST:/api/checkout`
  - `POST:/api/stripe/checkout`
  - `POST:/api/stripe/portal`
  - `POST:/api/plan`
  - `PUT:/api/plan`
  - `PATCH:/api/plan`
  - `DELETE:/api/plan`

### Tier C: CRUD/Actions
- **Rate Limits**: 60/min per user, 30/min per IP
- **Max Bytes**: 32768 (32KB) or 16384 (16KB) for tags/settings
- **Routes**:
  - `POST:/api/tags` (16KB)
  - `DELETE:/api/tags` (16KB)
  - `POST:/api/leads/[leadId]/tags` (16KB)
  - `DELETE:/api/leads/[leadId]/tags` (16KB)
  - `POST:/api/settings` (16KB)
  - `POST:/api/push-to-crm` (32KB)
  - `POST:/api/tracker` (32KB)
  - `POST:/api/verify-email` (32KB)

### Tier D: Read/Light
- **Rate Limits**: 120/min per user, 60/min per IP
- **Max Bytes**: 8192 (8KB)
- **Routes**:
  - `GET:/api/whoami`
  - `GET:/api/plan`
  - `GET:/api/history`
  - `GET:/api/tags`
  - `GET:/api/tracker`

### Tier E: Export
- **Rate Limits**: 2/min per user, 2/min per IP
- **Max Bytes**: 16384 (16KB)
- **Routes**:
  - `GET:/api/history/export`

### Tier W: Webhooks
- **Rate Limits**: 300/min per IP (IP backstop only, no user-based)
- **Max Bytes**: 262144 (256KB)
- **Routes**:
  - `POST:/api/stripe/webhook` (signature required)
  - `POST:/api/webhook`
  - `POST:/api/crypto-pay/webhook`

### Tier DEV: Dev-Only
- **Rate Limits**: Varies by route
- **Max Bytes**: Varies by route
- **Blocked in Production**: ✅ Yes
- **Requires Header**: `x-dev-key` (must match `DEV_SEED_SECRET`)
- **Routes**:
  - `POST:/api/dev/create-user` (10/min user, 5/min IP, 32KB)
  - `POST:/api/digest/test` (10/min user, 5/min IP, 32KB)
  - `GET:/api/test-error` (120/min user, 60/min IP, 8KB)
  - `POST:/api/digest/run` (10/min user, 5/min IP, 32KB)

## Policy Enforcement Locations

### Policy Definition
**File**: `lib/api/policy.ts`
- `ROUTE_POLICIES` object contains all route mappings
- `getRoutePolicy(pathname, method)` returns policy for route
- `normalizePathname()` handles dynamic segments (e.g., `[leadId]`)

### Guard Enforcement
**File**: `lib/api/guard.ts`
- `withApiGuard()` wrapper enforces all policies
- Enforcement order:
  1. Dev-only check (block in production, require `x-dev-key` in dev)
  2. Origin enforcement (for state-changing methods, except webhooks)
  3. Webhook signature verification (BEFORE rate limiting)
  4. Rate limiting (uses policy-defined limits via `checkPolicyRateLimit`)
  5. Request size limit (before parsing JSON)
  6. Query parameter validation (if schema provided)
  7. Body validation (if schema provided)

### Rate Limiting Implementation
**File**: `lib/api/ratelimit-policy.ts`
- `checkPolicyRateLimit()` uses policy-defined limits directly
- For Tier W (webhooks), always uses IP-based rate limiting (ignores userId)
- All other tiers use user-based if authenticated, IP-based if not

### Rate Limit Headers
All responses include:
- `X-RateLimit-Limit`: Policy-defined limit (authPerMin if authenticated, ipPerMin if not)
- `X-RateLimit-Remaining`: Remaining requests in current window (on errors only)

These headers are added to:
- Error responses (429 rate limit exceeded) - includes `Remaining`
- Success responses (for debugging) - includes `Limit` only

## Route-Specific Notes

### Plan Route
- **GET**: Tier D (read/light) - 120/min user, 60/min IP, 8KB
- **POST/PUT/PATCH/DELETE**: Tier B (payments) - 10/min user, 5/min IP, 32KB

### Webhooks
- Use IP-based rate limiting only (no user-based)
- Signature verification happens BEFORE rate limiting
- High rate limits (300/min) serve as DoS backstop only

### Dev Routes
- Automatically blocked in production (returns 404)
- In development, require `x-dev-key` header matching `DEV_SEED_SECRET`
- `digest/run` is dev-only unless cron-secret is implemented

## Code Locations

### Policy Map
```typescript
// lib/api/policy.ts
const ROUTE_POLICIES: Record<string, RoutePolicy> = {
  'POST:/api/generate-pitch': { tier: 'A', maxBytes: 65536, rateLimit: { authPerMin: 10, ipPerMin: 5 }, ... },
  'POST:/api/checkout': { tier: 'B', maxBytes: 32768, rateLimit: { authPerMin: 10, ipPerMin: 5 }, ... },
  // ... all routes
}
```

### Guard Implementation
```typescript
// lib/api/guard.ts
export function withApiGuard(
  handler: GuardedHandler,
  options: GuardOptions = {}
): (request: NextRequest) => Promise<NextResponse>
```

### Policy-Based Rate Limiting
```typescript
// lib/api/ratelimit-policy.ts
export async function checkPolicyRateLimit(
  request: NextRequest,
  userId: string | null,
  route: string,
  policy: RoutePolicy
): Promise<PolicyRateLimitResult | null>
```

### Route Usage
```typescript
// Example: app/api/generate-pitch/route.ts
export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    // Handler logic
  },
  { bodySchema: CompanyUrlSchema }
)
```

## Testing

```bash
# Test policy mapping
npm run test -- lib/api/policy.vitest.ts

# Test guard enforcement
npm run test -- lib/api/guard.vitest.ts
```

## Complete Policy Map

| Route | Method | Tier | Max Bytes | Auth/Min | IP/Min | Origin | Webhook Sig | Dev Only |
|-------|--------|------|-----------|----------|--------|--------|-------------|----------|
| `/api/generate-pitch` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/generate-sequence` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/generate-battle-card` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/generate-linkedin-comment` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/reveal` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/unlock-lead` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/send-pitch` | POST | A | 65536 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/checkout` | POST | B | 32768 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/stripe/checkout` | POST | B | 32768 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/stripe/portal` | POST | B | 32768 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/plan` | POST/PUT/PATCH/DELETE | B | 32768 | 10 | 5 | ✅ | ❌ | ❌ |
| `/api/tags` | POST/DELETE | C | 16384 | 60 | 30 | ✅ | ❌ | ❌ |
| `/api/leads/[leadId]/tags` | POST/DELETE | C | 16384 | 60 | 30 | ✅ | ❌ | ❌ |
| `/api/settings` | POST | C | 16384 | 60 | 30 | ✅ | ❌ | ❌ |
| `/api/push-to-crm` | POST | C | 32768 | 60 | 30 | ✅ | ❌ | ❌ |
| `/api/tracker` | POST | C | 32768 | 60 | 30 | ❌ | ❌ | ❌ |
| `/api/verify-email` | POST | C | 32768 | 60 | 30 | ✅ | ❌ | ❌ |
| `/api/whoami` | GET | D | 8192 | 120 | 60 | ❌ | ❌ | ❌ |
| `/api/plan` | GET | D | 8192 | 120 | 60 | ❌ | ❌ | ❌ |
| `/api/history` | GET | D | 8192 | 120 | 60 | ❌ | ❌ | ❌ |
| `/api/tags` | GET | D | 8192 | 120 | 60 | ❌ | ❌ | ❌ |
| `/api/tracker` | GET | D | 8192 | 120 | 60 | ❌ | ❌ | ❌ |
| `/api/history/export` | GET | E | 16384 | 2 | 2 | ❌ | ❌ | ❌ |
| `/api/stripe/webhook` | POST | W | 262144 | 300* | 300 | ❌ | ✅ | ❌ |
| `/api/webhook` | POST | W | 262144 | 300* | 300 | ❌ | ❌ | ❌ |
| `/api/crypto-pay/webhook` | POST | W | 262144 | 300* | 300 | ❌ | ❌ | ❌ |
| `/api/dev/create-user` | POST | DEV | 32768 | 10 | 5 | ❌ | ❌ | ✅ |
| `/api/digest/test` | POST | DEV | 32768 | 10 | 5 | ❌ | ❌ | ✅ |
| `/api/test-error` | GET | DEV | 8192 | 120 | 60 | ❌ | ❌ | ✅ |
| `/api/digest/run` | POST | DEV | 32768 | 10 | 5 | ❌ | ❌ | ✅ |

\* For Tier W, authPerMin is not used (webhooks use IP-only rate limiting)
