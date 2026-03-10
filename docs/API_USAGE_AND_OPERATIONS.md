# API usage and operations

LeadIntel records **sanitized** request visibility for platform API keys.

## What is logged

- method + route
- HTTP status
- internal error code (if any)
- request ID (when present)
- latency (ms)
- timestamp

No request bodies, generated content, or secrets are stored in the request logs.

## Where to view

- UI: `/settings/api/usage`
- API: `GET /api/platform/usage`

## Storage

- `api.api_request_logs` (migration `0058_platform_api_keys_and_usage.sql`)

