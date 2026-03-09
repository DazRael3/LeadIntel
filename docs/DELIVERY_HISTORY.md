# Delivery history (sanitized observability)

Delivery history answers: **what happened to a handoff/delivery attempt?**

It is intentionally **metadata-only**:

- action type
- destination type/id
- status
- timestamps
- sanitized failure reason
- correlation IDs (queue item id, webhook delivery id, export job id)

It does **not** show:

- webhook secrets
- raw provider payloads
- full generated premium content

---

## Data model

- **Table**: `api.action_deliveries`
- **API**: `GET /api/workspace/actions/delivery-history`

## UI

- **Integrations overview** includes a compact table (`components/settings/DeliveryHistoryTable.tsx`)
- Full history view:
  - `app/settings/integrations/history/*`

