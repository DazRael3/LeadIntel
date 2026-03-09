# API auth and keys

LeadIntel uses **workspace-scoped API keys** for `/api/v1/*`.

## Key model

- **Workspace scoped**: a key belongs to a single workspace.
- **Shown once**: the raw key is only returned at creation time.
- **Stored hashed**: only a hash is stored in `api.api_keys`.
- **Revocable**: revoking invalidates the key immediately.
- **Scopes**: keys are issued with explicit scopes (least privilege).

## Header format

Use standard bearer auth:

- `Authorization: Bearer li_sk_...`

## Key storage (database)

Created by migration:

- `supabase/migrations/0058_platform_api_keys_and_usage.sql`

Table:

- `api.api_keys`

## Secrets required

Key hashing uses a server-side “pepper”:

- `PLATFORM_API_KEY_PEPPER` (server env)

If this secret is not configured, platform API authentication returns a safe error (no key material is logged).

## Key management UI

- Create/revoke keys: `/settings/api`
- Governance (enable/disable API; who can manage keys): `/settings/platform`

