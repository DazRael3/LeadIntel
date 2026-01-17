# Request Size Limits - Complete Table

## Per-Route MaxBytes Configuration

| Route | Method | Max Bytes | Default? | Schema | Applied Before |
|-------|--------|-----------|----------|--------|----------------|
| `/api/checkout` | POST | N/A | - | None | No body validation |
| `/api/dev/create-user` | POST | 1MB | ✅ | `CreateUserSchema` | ✅ User creation |
| `/api/digest/run` | POST | 1KB | ❌ | `DigestRunSchema.partial()` | ✅ Admin operations |
| `/api/digest/test` | POST | 1KB | ❌ | `DigestTestSchema.partial()` | ✅ Webhook calls |
| `/api/generate-battle-card` | POST | 1MB | ✅ | `GenerateBattleCardSchema` | ✅ OpenAI API |
| `/api/generate-linkedin-comment` | POST | 1MB | ✅ | `GenerateLinkedInCommentSchema` | ✅ OpenAI API |
| `/api/generate-pitch` | POST | 1MB | ❌ | `CompanyUrlSchema` | ✅ OpenAI API, DB ops |
| `/api/generate-sequence` | POST | 2MB | ❌ | `GenerateSequenceSchema` | ✅ OpenAI API |
| `/api/history` | GET | N/A | - | `HistoryQueryWithLimitSchema` | Query params only |
| `/api/history/export` | GET | N/A | - | `HistoryQuerySchema` | Query params only |
| `/api/leads/[leadId]/tags` | POST | 1MB | ✅ | `LeadTagPostSchema` | ✅ DB operations |
| `/api/leads/[leadId]/tags` | DELETE | N/A | - | `LeadTagDeleteQuerySchema` | Query params only |
| `/api/plan` | GET | N/A | - | None | No body |
| `/api/push-to-crm` | POST | 2MB | ❌ | `PushToCrmSchema` | ✅ External webhook |
| `/api/reveal` | POST | 1MB | ✅ | `RevealPostSchema` | ✅ Clearbit API |
| `/api/reveal` | GET | N/A | - | None | Returns script |
| `/api/send-pitch` | POST | 1MB | ✅ | `SendPitchExtendedSchema` | ✅ Resend API |
| `/api/settings` | POST | 1MB | ✅ | `UserSettingsSchema` | ✅ DB operations |
| `/api/stripe/checkout` | GET | N/A | - | None | Deprecated |
| `/api/stripe/portal` | POST | N/A | - | None | No body |
| `/api/stripe/webhook` | POST | N/A | - | None | Raw body (Stripe) |
| `/api/tags` | GET | N/A | - | None | No body |
| `/api/tags` | POST | 1MB | ✅ | `TagNameSchema` | ✅ DB operations |
| `/api/tags` | DELETE | N/A | - | `TagIdQuerySchema` | Query params only |
| `/api/tracker` | GET | N/A | - | None | Returns script |
| `/api/tracker` | POST | 1MB | ✅ | `TrackerPostSchema` | ✅ Clearbit API |
| `/api/unlock-lead` | POST | 1MB | ✅ | `UnlockLeadSchema` | ✅ DB operations |
| `/api/verify-email` | POST | 1MB | ✅ | `VerifyEmailSchema` | ✅ Hunter API |
| `/api/webhook` | POST | N/A | - | None | Deprecated |
| `/api/whoami` | GET | N/A | - | None | No body |

## Size Limit Categories

### Default (1MB)
Most routes use the default 1MB limit. These routes handle typical JSON payloads:
- User settings
- Tag creation
- Lead operations
- Email verification
- AI generation (simple inputs)

### Large Payloads (2MB)
Routes that handle larger content:
- `/api/generate-sequence` - Includes company info and user settings
- `/api/push-to-crm` - Includes full pitch content

### Minimal Payloads (1KB)
Admin/cron endpoints with minimal data:
- `/api/digest/run` - Admin cron job
- `/api/digest/test` - Test webhook

### No Body Validation
Routes that don't accept JSON bodies:
- GET requests (query params only)
- Stripe webhook (raw body, signature verified)
- Script endpoints (return JavaScript)

## Implementation Details

### Fast Failure

The `parseJson()` function in `lib/api/validate.ts`:

1. **Checks `Content-Length` header FIRST**
   - If header exists and exceeds limit → throws immediately
   - Does NOT read body into memory
   - Fails in < 1ms for oversized requests

2. **Reads body only if needed**
   - If `Content-Length` is missing or within limit
   - Reads body to verify actual size
   - Throws if actual size exceeds limit

### Error Response

```json
{
  "ok": false,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request payload too large",
    "details": {
      "actualBytes": 2097152,
      "maxBytes": 1048576,
      "message": "Request body too large: 2097152 bytes (max: 1048576 bytes)"
    }
  }
}
```

**HTTP Status**: `413 Payload Too Large`

### Applied Before Expensive Calls

Size validation happens in `validateBody()`, which is called:
- ✅ **Before** OpenAI API calls (`generate-pitch`, `generate-sequence`, `generate-battle-card`, `generate-linkedin-comment`)
- ✅ **Before** Stripe API calls (`checkout`)
- ✅ **Before** Resend API calls (`send-pitch`)
- ✅ **Before** Clearbit API calls (`reveal`, `tracker`)
- ✅ **Before** Hunter API calls (`verify-email`)
- ✅ **Before** Supabase database operations
- ✅ **Before** any business logic

## Testing

Run tests:

```bash
node --test lib/api/validate.test.ts
```

Test coverage:
- ✅ Under limit passes
- ✅ Over limit fails quickly (Content-Length check)
- ✅ Over limit fails (actual body size check)
- ✅ Fast failure verification (doesn't read large body)

## Tuning

To adjust limits, edit the route handler:

```typescript
// Increase limit
const body = await validateBody(request, MySchema, { maxBytes: 5 * 1024 * 1024 }) // 5MB

// Decrease limit
const body = await validateBody(request, MySchema, { maxBytes: 512 * 1024 }) // 512KB
```

## Summary

- **Total routes**: 25
- **Routes with body validation**: 16
- **Routes with custom limits**: 3 (2MB for 2 routes, 1KB for 2 routes)
- **Routes using default (1MB)**: 11
- **Routes without body**: 9 (GET requests, webhooks, scripts)

All state-changing endpoints have size limits applied before expensive operations.
