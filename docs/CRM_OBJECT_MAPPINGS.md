# CRM object mappings

LeadIntel stores **explicit** mappings between internal objects and external CRM object identifiers.

## Tables

- `api.crm_object_mappings`
  - **account mapping**: one per `(workspace_id, account_id, crm_system)`
  - **opportunity mapping**: many per account; unique per `(workspace_id, crm_system, crm_object_id)`

## Fields (high level)

- **crm_system**: currently `generic` (no vendor-specific sync implied).
- **crm_object_id**: external identifier (string).
- **mapping_kind**: `account` or `opportunity`.
- **status**: `mapped | ambiguous | stale | unmapped`
- **verification_status**: `unverified | verified | ambiguous | not_linked | needs_review`

## Mapping behavior

- Mappings are **never auto-forced**. Creation happens via explicit user action.
- For accounts, upserts are deduped via the unique index.
- For opportunities, multiple mapped opportunities can exist per account.
- Verification is explicit via `api.revenue_verification_reviews` and mirrored into `verification_status` for faster queueing.

## Security and scope

- Workspace-scoped (RLS requires workspace membership).
- Creation allowed for workspace members; updates allowed for creator or workspace owner/admin/manager.
- The mapping system is **not** a CRM sync or bi-directional field mapper.

