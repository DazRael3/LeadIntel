# Integrations Architecture (Action Wave)

LeadIntel’s integrations are designed as a **workflow delivery layer** between:

- fresh signal detection
- account prioritization + explainability
- handoff packaging (CRM / sequencer style)
- downstream execution via **workspace-configured destinations**

This repo currently ships **production-safe destinations** via:

- **Webhooks** (`api.webhook_endpoints`, `api.webhook_deliveries`)
- **Exports** (`api.export_jobs`)

It **does not** claim or implement native OAuth CRM/sequencer sync (Salesforce/HubSpot/Outreach/Salesloft) unless explicitly added end-to-end.

---

## Core concepts

### Integration registry

- **File**: `lib/integrations/registry.ts`
- **Types**: `lib/integrations/types.ts`

Each integration/destination is a typed descriptor:

- **family**: `webhook | export | crm | sequencer | playbooks | internal`
- **capabilities**: a capability map (what the destination supports)
- **implementation**: `native | via_webhook | via_export | workspace_internal`

### Connection state model

- **Type**: `ConnectionState` in `lib/integrations/types.ts`
- **States**:
  - `not_connected`: no endpoint/config exists
  - `configured`: partially set up (e.g., endpoint exists but default not set)
  - `limited`: usable but missing something meaningful (reserved)
  - `ready`: configured and usable
  - `error`: configuration exists but is broken (reserved)

### Workspace summary API

- **Route**: `app/api/workspace/integrations/summary/route.ts`
- **Service**: `lib/services/integrations-summary.ts`

Returns a single summary payload for UI:

- integration descriptors + connection status
- workspace defaults (currently: **default handoff webhook endpoint**)

### Default destinations

In this wave, one-click “deliver” uses a workspace default destination:

- **DB column**: `api.workspaces.default_handoff_webhook_endpoint_id`
- **API**: `POST /api/workspace/integrations/defaults` (owner/admin only)

The endpoint must be:

- enabled
- subscribed to the relevant event types (e.g. `handoff.*` events)

---

## Delivery surfaces

### Account action center

- **UI**: `components/account/AccountActionCenter.tsx`
- **Handoffs**:
  - `components/account/CrmHandoffCard.tsx`
  - `components/account/SequencerHandoffCard.tsx`

Handoffs are **prepared** (queue item created) and optionally **delivered** (webhook delivery enqueued).

### Workspace action queue

- **UI**: `app/dashboard/actions/*`
- **API**: `GET /api/workspace/actions/queue`

Queue items are the system of record for “what’s ready to do next” in the workspace.

### Delivery history

- **UI**: `app/settings/integrations/history/*`
- **API**: `GET /api/workspace/actions/delivery-history`

History is **metadata-only** and is safe for operators/support.

---

## Security + gating

- Integrations and action orchestration are **Team-plan gated** using `requireTeamPlan`.
- Admin-only changes (defaults, recipes) require workspace role `owner|admin`.
- Delivery and audit surfaces avoid secrets and avoid raw provider error dumps.

