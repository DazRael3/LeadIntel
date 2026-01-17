# API Route Validation Table

This document lists all API routes, their validation schemas, and maximum JSON body sizes.

## Validation Utilities

- **Location**: `lib/api/validate.ts`
- **Shared Schemas**: `lib/api/schemas.ts`
- **Default Max Body Size**: 1MB (1024 * 1024 bytes)
- **Test File**: `lib/api/validate.test.ts`

## Route Validation Summary

| Route | Method | Schema | Max Bytes | Notes |
|-------|--------|--------|-----------|-------|
| `/api/checkout` | POST | None | N/A | No body, auth-only |
| `/api/dev/create-user` | POST | `CreateUserSchema` | 1MB | Dev-only, requires header secret |
| `/api/digest/run` | POST | `DigestRunSchema.partial()` | 1KB | Admin-only, requires header secret |
| `/api/digest/test` | POST | `DigestTestSchema.partial()` | 1KB | Auth required |
| `/api/generate-battle-card` | POST | `GenerateBattleCardSchema` | 1MB | Pro-only feature |
| `/api/generate-linkedin-comment` | POST | `GenerateLinkedInCommentSchema` | 1MB | Public endpoint |
| `/api/generate-pitch` | POST | `CompanyUrlSchema` | 1MB | Main pitch generation |
| `/api/generate-sequence` | POST | `GenerateSequenceSchema` | 2MB | Pro-only, includes company info |
| `/api/history` | GET | `HistoryQueryWithLimitSchema` | N/A | Query params only |
| `/api/history/export` | GET | `HistoryQuerySchema` | N/A | Query params only, CSV export |
| `/api/leads/[leadId]/tags` | POST | `LeadTagPostSchema` | 1MB | Path param + body validation |
| `/api/leads/[leadId]/tags` | DELETE | `LeadTagDeleteQuerySchema` | N/A | Path param + query validation |
| `/api/plan` | GET | None | N/A | No params, auth-only |
| `/api/push-to-crm` | POST | `PushToCrmSchema` | 2MB | Includes pitch content |
| `/api/reveal` | POST | `RevealPostSchema` | 1MB | Pro-only, IP validation |
| `/api/reveal` | GET | None | N/A | Returns tracking script |
| `/api/send-pitch` | POST | `SendPitchExtendedSchema` | 1MB | Pro-only feature |
| `/api/settings` | POST | `UserSettingsSchema` | 1MB | User settings update |
| `/api/stripe/checkout` | GET | None | N/A | Deprecated (410) |
| `/api/stripe/portal` | POST | None | N/A | No body, auth-only |
| `/api/stripe/webhook` | POST | None | N/A | Stripe webhook payload (external) |
| `/api/tags` | GET | None | N/A | No params, auth-only |
| `/api/tags` | POST | `TagNameSchema` | 1MB | Create tag |
| `/api/tags` | DELETE | `TagIdQuerySchema` | N/A | Query param only |
| `/api/tracker` | GET | None | N/A | Returns tracking script |
| `/api/tracker` | POST | `TrackerPostSchema` | 1MB | Visitor tracking |
| `/api/unlock-lead` | POST | `UnlockLeadSchema` | 1MB | Free tier unlock logic |
| `/api/verify-email` | POST | `VerifyEmailSchema` | 1MB | Email verification |
| `/api/webhook` | POST | None | N/A | Deprecated (410) |
| `/api/whoami` | GET | None | N/A | Debug endpoint, no params |

## Schema Definitions

### Shared Schemas (`lib/api/schemas.ts`)

#### Query Parameter Schemas
- `PaginationSchema`: `page`, `limit`, `cursor` (all optional, transformed to numbers)
- `SearchSchema`: `q`, `search` (optional strings)
- `TagFilterSchema`: `tag`, `tags` (optional string or array)
- `HistoryQuerySchema`: Combines `PaginationSchema`, `SearchSchema`, `TagFilterSchema`

#### Body Schemas
- `CompanyUrlSchema`: `companyUrl` (required URL string)
- `LeadIdSchema`: `leadId` (required UUID)
- `TagNameSchema`: `name` (required string, 1-100 chars)
- `UserSettingsSchema`: Complete user settings with digest options
- `VerifyEmailSchema`: `email` (required email string)
- `PushToCrmSchema`: Lead data for CRM export
- `SendPitchSchema`: Email sending parameters
- `UnlockLeadSchema`: `leadId` (required UUID)
- `GeneratePitchOptionsSchema`: Pitch generation options
- `DigestRunSchema`: Admin digest run parameters
- `DigestTestSchema`: User digest test parameters
- `TrackerSchema`: Visitor tracking data
- `RevealSchema`: Email reveal parameters

### Route-Specific Schemas

#### `GenerateBattleCardSchema`
```typescript
{
  companyName: string (required, min 1)
  companyUrl?: string (optional URL)
  triggerEvent?: string (optional)
}
```

#### `GenerateSequenceSchema`
```typescript
{
  companyName: string (required, min 1)
  triggerEvent: string (required, min 1)
  ceoName?: string (optional)
  companyInfo?: string (optional)
  userSettings?: Record<string, unknown> (optional)
}
```

#### `GenerateLinkedInCommentSchema`
```typescript
{
  companyName: string (required, min 1)
  triggerEvent: string (required, min 1)
  userSettings?: Record<string, unknown> (optional)
}
```

#### `RevealPostSchema`
```typescript
{
  visitor_ip: string (required, valid IP address)
}
```

#### `TrackerPostSchema`
```typescript
{
  user_agent?: string (optional)
  referer?: string (optional)
  url?: string (optional URL)
  timestamp?: string (optional)
}
```

#### `LeadTagPostSchema`
```typescript
{
  tagId: string (required UUID)
}
```

#### `LeadTagDeleteQuerySchema`
```typescript
{
  tagId: string (required UUID)
}
```

#### `TagIdQuerySchema`
```typescript
{
  id: string (required UUID)
}
```

#### `SendPitchExtendedSchema`
```typescript
{
  leadId: string (required UUID)
  recipientEmail: string (required email)
  recipientName?: string (optional)
  companyName?: string (optional)
}
```

#### `PushToCrmSchema`
```typescript
{
  company_name?: string (optional)
  trigger_event?: string (optional)
  prospect_email?: string (optional email)
  prospect_linkedin?: string (optional URL)
  contact_email?: string (optional email)
  ai_personalized_pitch?: string (optional)
  created_at?: string (optional)
}
```

#### `CreateUserSchema` (dev-only)
```typescript
{
  email: string (required email)
  password: string (required, min 8 chars)
}
```

## Validation Error Response Format

All validation errors return standardized format:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "fieldName",
        "message": "Error message",
        "code": "invalid_type"
      }
    ]
  }
}
```

## Max Bytes Overrides

Routes with custom `maxBytes`:

- `/api/generate-sequence`: **2MB** (includes company info + user settings)
- `/api/push-to-crm`: **2MB** (includes pitch content)
- `/api/digest/run`: **1KB** (minimal admin payload)
- `/api/digest/test`: **1KB** (minimal test payload)
- All others: **1MB** (default)

## Routes Without Validation

These routes intentionally skip body/query validation:

1. **Webhook endpoints** (`/api/stripe/webhook`): Receive external payloads from Stripe
2. **GET-only endpoints** with no parameters: `/api/plan`, `/api/whoami`, `/api/tags` (GET)
3. **Script endpoints**: `/api/reveal` (GET), `/api/tracker` (GET) - return JavaScript
4. **Deprecated endpoints**: `/api/stripe/checkout` (GET), `/api/webhook` (POST) - return 410
5. **Auth-only endpoints**: `/api/checkout`, `/api/stripe/portal` - no body needed

## Testing

Run validation tests:

```bash
# Using Node.js test runner
node --test lib/api/validate.test.ts

# Or using tsx
npx tsx lib/api/validate.test.ts
```

Test coverage includes:
- Valid JSON parsing
- Invalid JSON rejection
- Oversized payload rejection (content-length header)
- Oversized payload rejection (actual body size)
- Payload within size limit acceptance
- Default maxBytes behavior
- Zod schema validation
- Query parameter validation
- Validation error formatting

## Implementation Notes

1. **Validation happens before business logic**: All routes validate input before calling OpenAI, Stripe, Supabase, or any external services.

2. **Path parameters**: Routes with path parameters (e.g., `/api/leads/[leadId]/tags`) validate path params separately using Zod UUID validation.

3. **Cookie bridging**: All validation helpers accept an optional `cookieBridge` parameter for Supabase auth cookie forwarding.

4. **Error handling**: Validation errors are automatically formatted using `validationError()` helper, which returns standardized error responses.

5. **Type safety**: All validated data is typed using Zod's `z.infer<T>` utility, ensuring type safety throughout route handlers.
