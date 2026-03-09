# Workspace policies

LeadIntel supports a small set of **workspace-level policies** designed to be:

- **truthful** (no fake “enterprise” toggles)
- **enforced server-side** (not just UI)
- **audited** (policy changes are logged)

## Policy model

Policies are stored per workspace in `api.workspace_policies.policy` (JSON).

The canonical shape is defined in:

- `lib/domain/workspace-policies.ts`

## Current policies (implemented + enforced)

### Invite domain allowlist

- **Key**: `invite.allowedDomains`
- **Meaning**:
  - `null` or empty: no domain restriction
  - non-empty list: only emails in those domains can be invited
- **Enforcement**:
  - `POST /api/team/invites` rejects disallowed domains
  - denial is audited as `invite.denied_by_policy`

### Export permissions by role

- **Key**: `exports.allowedRoles`
- **Default**: `['owner','admin']` (matches current product behavior)
- **Enforcement**:
  - `POST /api/exports/create`
  - `POST /api/accounts/:id/export`

### Require approval before handoff delivery

- **Key**: `handoffs.requireApproval`
- **Meaning**: when enabled, delivery workflows can require approval checks (where implemented).

### Intelligence controls

- **Key**: `intelligence.*`
- **Meaning**: controls bounded, feedback/outcome-informed recommendation nudges.
- **Enforcement**:
  - `/api/accounts/:id/recommendations` respects adaptive/feedback/outcome toggles
  - `/settings/intelligence` is Team-gated and updates workspace policy state

### Planning intelligence controls

- **Key**: `planning.*`
- **Meaning**: gates account planning, influence, and forecast-support surfaces.
- **Enforcement**:
  - `/api/accounts/:id/plan`, `/api/accounts/:id/touch-plan`, `/api/accounts/:id/pipeline-influence`
  - `/api/team/planning`, `/api/team/forecast-support`
  - `/settings/planning-intelligence`

## Audit

Policy updates are audited as:

- `workspace.policy_updated`

The audit metadata intentionally avoids sensitive content (no secrets).

