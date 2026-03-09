# CRM handoff (workflow delivery)

LeadIntel’s **CRM handoff** is a **packaging layer**: it prepares a concise, typed payload that can be delivered to your CRM logging workflow **via webhook or export**.

It is **not** a native bidirectional sync.

---

## What it does

When a rep prepares a CRM handoff from an account, LeadIntel packages:

- account identifiers (id, name, domain/url when present)
- score + momentum
- “why now” summary and top signals
- persona recommendations
- data quality / freshness limitations (coarse, honest labels)
- link back to LeadIntel (when `NEXT_PUBLIC_SITE_URL` is set)

The payload can be used downstream to create:

- a task-style handoff record
- a note-style handoff record
- a lightweight “account push” record

---

## API + flow

### Prepare

- **Route**: `POST /api/accounts/:accountId/actions/crm`
- **Creates**: a queue item in `api.action_queue_items` with type `crm_handoff_prepared`
- **Returns**: `queueItemId` and a payload preview

### Deliver (via webhook destination)

- **Route**: `POST /api/workspace/actions/queue/:queueItemId/deliver`
- **Enqueues**: a webhook delivery via the workspace default endpoint
- **Event type**: `handoff.crm.delivered`

Delivery is queued and retried by the existing webhook delivery runner.

---

## Payload shape

- **Builder**: `lib/services/destination-payloads.ts`
- **Type**: `CrmHandoffPayload`

Payloads are:

- **versioned**
- **concise** (bounded string length)
- **metadata-first** (no raw provider dumps)

---

## Safety rules

- No webhook secrets are exposed in UI or logs.
- Delivery history is sanitized (status + failure reason only).
- Team gating is enforced server-side (Team plan required).

