# Secret safety and error redaction

LeadIntel aims to avoid leaking secrets in:

- API error responses
- server logs
- operator/admin surfaces

## What this wave implements

- Removal of placeholder fallback behavior for `ZAPIER_WEBHOOK_URL` (CRM push will **not** send to a placeholder URL).
- Token/key redaction for error messages returned via `asHttpError()` and logged by the API HTTP utilities.

## Files

- `lib/security/token-redaction.ts`
- `lib/api/http.ts` (uses redaction before logging/returning messages)

## Notes

Redaction is best-effort and pattern-based. It is not a substitute for careful code that avoids including secrets in error messages in the first place.

