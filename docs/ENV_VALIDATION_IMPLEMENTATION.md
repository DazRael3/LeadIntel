# Environment Variable Validation Implementation

**Date**: January 2025  
**Task**: Implement robust environment variable validation using Zod

---

## Summary

Implemented comprehensive environment variable validation system using Zod schemas. The system separates client-safe variables (NEXT_PUBLIC_*) from server-only secrets, validates at module load time, and prevents secrets from leaking to client bundles.

---

## Files Created/Modified

### Created Files

1. **`lib/env.ts`** - Comprehensive Zod-based environment validation
   - Client-safe variables (`clientEnv`)
   - Server-only variables (`serverEnv`)
   - Runtime validation with helpful error messages
   - Prevents server env access in client code

2. **`lib/env.test.ts`** - Unit tests for env validation
   - Tests format validation
   - Tests required vs optional variables
   - Uses Node.js built-in test runner

3. **`docs/ENV_VARIABLES_CHECKLIST.md`** - Complete inventory
   - All 22 environment variables documented
   - File-by-file usage mapping
   - Migration status tracking

4. **`docs/ENV_VALIDATION_IMPLEMENTATION.md`** - This file

### Modified Files

1. **`lib/stripe.ts`**
   - Replaced: `process.env.STRIPE_SECRET_KEY`
   - With: `serverEnv.STRIPE_SECRET_KEY`

2. **`lib/ai-logic.ts`**
   - Replaced: `process.env.OPENAI_API_KEY`
   - With: `serverEnv.OPENAI_API_KEY`

3. **`app/api/send-pitch/route.ts`**
   - Replaced: `process.env.RESEND_API_KEY`, `process.env.RESEND_FROM_EMAIL`
   - With: `serverEnv.RESEND_API_KEY`, `serverEnv.RESEND_FROM_EMAIL`

4. **`app/api/checkout/route.ts`**
   - Replaced: `process.env.STRIPE_SECRET_KEY`, `process.env.STRIPE_PRICE_ID`, `process.env.NEXT_PUBLIC_SITE_URL`
   - With: `serverEnv.STRIPE_PRICE_ID`, `clientEnv.NEXT_PUBLIC_SITE_URL`

5. **`app/api/stripe/webhook/route.ts`**
   - Replaced: `process.env.STRIPE_WEBHOOK_SECRET`, `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NODE_ENV`
   - With: `serverEnv.STRIPE_WEBHOOK_SECRET`, `serverEnv.SUPABASE_SERVICE_ROLE_KEY`, `clientEnv.NEXT_PUBLIC_SUPABASE_URL`, `serverEnv.NODE_ENV`

6. **`app/api/generate-pitch/route.ts`**
   - Replaced: `process.env.OPENAI_API_KEY`, `process.env.NODE_ENV`, `process.env.CLEARBIT_API_KEY`, `process.env.NEWS_API_KEY`
   - With: `serverEnv.OPENAI_API_KEY`, `serverEnv.NODE_ENV`, `serverEnv.CLEARBIT_API_KEY`, `serverEnv.NEWS_API_KEY`

---

## .env.example Content

**Note**: `.env.example` file creation was blocked by `.gitignore`. Here's the content to create manually:

```env
# LeadIntel Environment Variables
# Copy this file to .env.local and fill in your values

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api
SUPABASE_DB_SCHEMA_FALLBACK=api

# Stripe Configuration
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID=
STRIPE_PRICE_ID_PRO=
STRIPE_WEBHOOK_SECRET=

# OpenAI Configuration
OPENAI_API_KEY=

# Resend Configuration
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Clearbit Configuration
CLEARBIT_REVEAL_API_KEY=
CLEARBIT_API_KEY=

# Application Configuration
NEXT_PUBLIC_SITE_URL=
NODE_ENV=development

# Optional Third-Party Integrations
HUNTER_API_KEY=
NEWS_API_KEY=
ZAPIER_WEBHOOK_URL=
ADMIN_DIGEST_SECRET=
DEV_SEED_SECRET=
```

**Action Required**: Create `.env.example` file in root directory with the above content.

---

## Key Features

### 1. Separation of Client vs Server Variables

- **Client-safe** (`clientEnv`): Only `NEXT_PUBLIC_*` variables
- **Server-only** (`serverEnv`): All secrets, never exposed to client
- Runtime check prevents `serverEnv` access in client code

### 2. Validation at Module Load Time

- Validates all required variables when `lib/env.ts` is imported
- App fails fast with clear error messages
- Helpful hints guide developers to fix issues

### 3. Format Validation

- **Stripe keys**: Must start with `sk_` (secret) or `pk_` (publishable)
- **Stripe webhook**: Must start with `whsec_`
- **Stripe price ID**: Must start with `price_`
- **OpenAI key**: Must start with `sk-`
- **Resend key**: Must start with `re_`
- **URLs**: Must be valid URL format
- **Emails**: Must be valid email format

### 4. Required vs Optional

- **Required**: Validated at startup, app won't start if missing
- **Optional**: Can be undefined, code handles gracefully

---

## Environment Variables Summary

**Total**: 22 variables
- **Client-safe**: 5 (3 required, 2 optional)
- **Server-only**: 17 (5 required, 12 optional)

### Required Variables (8 total)

**Client (3)**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Server (5)**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

### Optional Variables (14 total)

**Client (2)**:
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`
- `NEXT_PUBLIC_SITE_URL`

**Server (12)**:
- `SUPABASE_DB_SCHEMA`
- `SUPABASE_DB_SCHEMA_FALLBACK`
- `STRIPE_PRICE_ID`
- `STRIPE_PRICE_ID_PRO`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CLEARBIT_REVEAL_API_KEY`
- `CLEARBIT_API_KEY`
- `HUNTER_API_KEY`
- `NEWS_API_KEY`
- `ZAPIER_WEBHOOK_URL`
- `ADMIN_DIGEST_SECRET`
- `DEV_SEED_SECRET`
- `NODE_ENV` (auto-set by Next.js)

---

## Migration Status

### ✅ Completed (7 files)
- `lib/env.ts` - Created
- `lib/stripe.ts` - Updated
- `lib/ai-logic.ts` - Updated
- `app/api/send-pitch/route.ts` - Updated
- `app/api/checkout/route.ts` - Updated
- `app/api/stripe/webhook/route.ts` - Updated
- `app/api/generate-pitch/route.ts` - Updated

### ⚠️ Pending (11 files)
- `app/api/generate-battle-card/route.ts`
- `app/api/generate-sequence/route.ts`
- `app/api/generate-linkedin-comment/route.ts`
- `app/api/tracker/route.ts`
- `app/api/reveal/route.ts`
- `app/api/verify-email/route.ts`
- `app/api/push-to-crm/route.ts`
- `app/api/digest/run/route.ts`
- `app/api/dev/create-user/route.ts`
- `app/api/stripe/portal/route.ts`
- `lib/supabase/*.ts` (all client files)
- `lib/supabase/schema.ts`

**Note**: Remaining files can be updated incrementally. Critical paths (Stripe, OpenAI, webhooks) are already migrated.

---

## Testing

### Run Tests

```bash
# Using Node.js test runner (Node 18+)
node --test lib/env.test.ts

# Or using tsx
npx tsx lib/env.test.ts
```

### Test Coverage

- ✅ Format validation (Stripe keys, OpenAI keys, URLs)
- ✅ Required vs optional variables
- ✅ Client vs server separation
- ⚠️ Module load-time validation (requires test runner with module isolation)

**Note**: Full module load-time validation tests require Jest/Vitest for module isolation. Current tests validate schema logic.

---

## Usage Examples

### Server-Side Code

```typescript
import { serverEnv } from '@/lib/env'

// Access validated server environment variables
const apiKey = serverEnv.OPENAI_API_KEY // ✅ Validated, type-safe
const stripeKey = serverEnv.STRIPE_SECRET_KEY // ✅ Validated, type-safe
const optionalKey = serverEnv.RESEND_API_KEY // ✅ Optional, may be undefined
```

### Client-Side Code

```typescript
import { clientEnv } from '@/lib/env'

// Access validated client environment variables
const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL // ✅ Validated, type-safe
const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL // ✅ Optional, may be undefined

// ❌ This will throw an error:
// const secret = serverEnv.STRIPE_SECRET_KEY // Error: Cannot access serverEnv in client code
```

---

## Error Messages

The validation system provides helpful error messages:

```
❌ Invalid server environment variables:
  - STRIPE_SECRET_KEY: Invalid Stripe secret key format
    💡 Get your Stripe secret key from: https://dashboard.stripe.com/apikeys
  - OPENAI_API_KEY: Invalid OpenAI API key format
    💡 Get your OpenAI API key from: https://platform.openai.com/api-keys
```

---

## Security Benefits

1. **No secrets in client bundles**: Server-only variables are never exposed
2. **Fail fast**: App won't start with invalid/missing required variables
3. **Type safety**: TypeScript types inferred from Zod schemas
4. **Format validation**: Prevents common configuration errors
5. **Clear errors**: Helpful messages guide developers to fix issues

---

## Next Steps

1. ✅ Create `lib/env.ts` with Zod validation
2. ✅ Update critical files (Stripe, OpenAI, webhooks)
3. ⚠️ Update remaining API routes (11 files)
4. ⚠️ Update Supabase client files
5. ⚠️ Create `.env.example` manually (content provided above)
6. ✅ Create test file
7. ⚠️ Set up test runner (Jest/Vitest) for full test coverage

---

## Acceptance Criteria

- [x] `lib/env.ts` created with Zod validation
- [x] Client vs server variables separated
- [x] Server-only env validated at startup
- [x] Critical files updated to use `serverEnv`/`clientEnv`
- [x] `.env.example` content provided (file creation blocked by gitignore)
- [x] Unit test created for env validation
- [x] Checklist document created with all env vars
- [x] No secrets leaked to client bundles
- [x] Client env restricted to NEXT_PUBLIC_* only
- [ ] Remaining files updated (11 files pending - can be done incrementally)

---

**Status**: ✅ Core implementation complete, incremental migration in progress
