# Request Size Limits Per Route

This document lists the maximum request body size (`maxBytes`) for each API route.

## Implementation

Request size limits are enforced in **`lib/api/validate.ts`** via the `parseJson()` and `validateBody()` functions.

### Key Features

1. **Fast Failure**: Checks `Content-Length` header FIRST to reject oversized requests without reading body
2. **Memory Efficient**: If `Content-Length` exceeds limit, throws immediately (doesn't read body into memory)
3. **413 Status**: Returns `PAYLOAD_TOO_LARGE` error with 413 status code
4. **Before Expensive Calls**: Validation happens before OpenAI, Stripe, or other expensive operations

## Per-Route Limits

| Route | Method | Max Bytes | Schema | Notes |
|-------|--------|-----------|--------|-------|
| `/api/checkout` | POST | 1MB (default) | None | No body validation |
| `/api/dev/create-user` | POST | 1MB (default) | `CreateUserSchema` | Dev-only |
| `/api/digest/run` | POST | 1KB | `DigestRunSchema.partial()` | Admin-only, minimal payload |
| `/api/digest/test` | POST | 1KB | `DigestTestSchema.partial()` | Minimal payload |
| `/api/generate-battle-card` | POST | 1MB (default) | `GenerateBattleCardSchema` | AI generation |
| `/api/generate-linkedin-comment` | POST | 1MB (default) | `GenerateLinkedInCommentSchema` | AI generation |
| `/api/generate-pitch` | POST | 1MB | `CompanyUrlSchema` | AI generation, main endpoint |
| `/api/generate-sequence` | POST | 2MB | `GenerateSequenceSchema` | AI generation, includes company info |
| `/api/history` | GET | N/A | `HistoryQueryWithLimitSchema` | Query params only |
| `/api/history/export` | GET | N/A | `HistoryQuerySchema` | Query params only |
| `/api/leads/[leadId]/tags` | POST | 1MB (default) | `LeadTagPostSchema` | Path param + body |
| `/api/leads/[leadId]/tags` | DELETE | N/A | `LeadTagDeleteQuerySchema` | Query params only |
| `/api/plan` | GET | N/A | None | No body |
| `/api/push-to-crm` | POST | 2MB | `PushToCrmSchema` | Includes pitch content |
| `/api/reveal` | POST | 1MB (default) | `RevealPostSchema` | Pro-only feature |
| `/api/reveal` | GET | N/A | None | Returns script |
| `/api/send-pitch` | POST | 1MB (default) | `SendPitchExtendedSchema` | Pro-only feature |
| `/api/settings` | POST | 1MB (default) | `UserSettingsSchema` | User settings |
| `/api/stripe/checkout` | GET | N/A | None | Deprecated |
| `/api/stripe/portal` | POST | N/A | None | No body |
| `/api/stripe/webhook` | POST | N/A | None | Stripe webhook (raw body) |
| `/api/tags` | GET | N/A | None | No body |
| `/api/tags` | POST | 1MB (default) | `TagNameSchema` | Create tag |
| `/api/tags` | DELETE | N/A | `TagIdQuerySchema` | Query params only |
| `/api/tracker` | GET | N/A | None | Returns script |
| `/api/tracker` | POST | 1MB (default) | `TrackerPostSchema` | Visitor tracking |
| `/api/unlock-lead` | POST | 1MB (default) | `UnlockLeadSchema` | Free tier unlock |
| `/api/verify-email` | POST | 1MB (default) | `VerifyEmailSchema` | Email verification |
| `/api/webhook` | POST | N/A | None | Deprecated |
| `/api/whoami` | GET | N/A | None | No body |

## Default Limits

- **Default**: 1MB (1,048,576 bytes)
- **Large payloads**: 2MB (for routes with company info or pitch content)
- **Minimal payloads**: 1KB (for admin/cron endpoints)

## Error Response

When payload exceeds limit:

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

## Implementation Details

### Fast Failure

The `parseJson()` function:
1. **Checks `Content-Length` header first** - If exceeds limit, throws immediately (doesn't read body)
2. **Reads body only if needed** - If `Content-Length` is missing or within limit, reads body to verify
3. **Throws `PayloadTooLargeError`** - Custom error class for payload size violations

### Before Expensive Calls

Size validation happens in `validateBody()`, which is called:
- ✅ **Before** OpenAI API calls
- ✅ **Before** Stripe API calls
- ✅ **Before** Supabase database operations
- ✅ **Before** any business logic

### Example Usage

```typescript
export async function POST(request: NextRequest) {
  try {
    // Size validation happens here (before any expensive operations)
    const body = await validateBody(request, MySchema, { maxBytes: 2 * 1024 * 1024 })
    
    // Expensive operations happen after validation
    const result = await expensiveOperation(body)
    return ok(result)
  } catch (error) {
    return validationError(error, bridge)
  }
}
```

## Testing

Run tests:

```bash
node --test lib/api/validate.test.ts
```

Tests verify:
- ✅ Under limit passes
- ✅ Over limit fails quickly (Content-Length check)
- ✅ Over limit fails (actual body size check)
- ✅ Fast failure when Content-Length exceeds limit (doesn't read body)

## Tuning Limits

To adjust limits per route, edit the route handler:

```typescript
// Increase limit for a route
const body = await validateBody(request, MySchema, { maxBytes: 5 * 1024 * 1024 }) // 5MB

// Decrease limit for a route
const body = await validateBody(request, MySchema, { maxBytes: 512 * 1024 }) // 512KB
```

## Production Considerations

1. **Monitor payload sizes**: Track actual payload sizes to optimize limits
2. **Adjust based on usage**: Increase limits if legitimate users hit limits
3. **Consider compression**: If payloads are large, consider client-side compression
4. **Rate limiting**: Combine with rate limiting to prevent abuse
