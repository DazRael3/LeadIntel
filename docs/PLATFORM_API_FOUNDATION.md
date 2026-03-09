# Platform API foundation

LeadIntel’s platform API is a **workspace-scoped**, **typed**, and **policy-gated** surface intended for safe automation and embedding.

## Core properties

- **Versioned namespace**: `/api/v1/*`
- **Workspace-scoped**: every request resolves to a single workspace via the API key.
- **Policy-gated**: workspace policies can disable API access entirely.
- **Typed envelopes**: responses use `{ ok: true, data }` or `{ ok: false, error }`.
- **Rate-limited**: key-based rate limiting reuses the existing rate-limit infrastructure.
- **No premium leakage**: platform serializers are metadata-first and avoid returning generated bodies.

## Enabling

Platform API access is **disabled by default** at the workspace policy level:

- Settings: `/settings/platform`
- Policy flag: `policies.platform.apiAccessEnabled`

## Route registry

The in-product route table is driven from `lib/platform-api/registry.ts` and rendered at:

- `/developers`

