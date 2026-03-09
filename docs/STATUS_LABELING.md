# Status Labeling

LeadIntel standardizes user-facing status language across async/operational workflows.

## Canonical statuses

Preferred canonical labels:

- `queued`
- `processing`
- `ready`
- `retrying`
- `delivered`
- `failed`

Additional canonical labels used for product clarity:

- `limited_data`
- `locked_preview`
- `saved`

## Mappings

### Export jobs (`api.export_jobs.status`)

- `pending` → **Processing**
- `ready` → **Ready**
- `failed` → **Failed**

### Webhook deliveries (`api.webhook_deliveries.status`)

- `pending` + attempts = 0 → **Queued**
- `pending` + attempts > 0 → **Retrying**
- `sent` → **Delivered**
- `failed` → **Failed**

## Implementation

- `lib/ui/status-labels.ts` provides mapping helpers and badge tone classes.

