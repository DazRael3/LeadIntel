# API reference (v1)

The canonical list of platform routes is maintained in code:

- `lib/platform-api/registry.ts`

The in-product developer view renders this registry at:

- `/developers`

## Conventions

- **Auth**: `Authorization: Bearer li_sk_...`
- **Envelope**:
  - success: `{ ok: true, data: ... }`
  - error: `{ ok: false, error: { code, message, details?, requestId? } }`
- **Pagination**: list endpoints return `{ items, pagination: { nextCursor } }`

