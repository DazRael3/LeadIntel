# Audit and Operator Tooling

This wave upgrades auditability and adds narrow admin/operator tooling for reliable support.

## Audit log

Audit events are **workspace-scoped** and **metadata-first**:

- actor user id (and resolved email/display name where available)
- action string
- target type + target id (when present)
- created timestamp
- meta (sanitized in UI; no generated content bodies)

### UI

- `app/settings/audit/*` (Team-gated)
  - filters (action, actor, from/to)
  - pagination
  - detail panel with sanitized meta

### Common actions recorded

- `export.created`, `export.failed`, `export.downloaded`
- `webhook.endpoint_created`, `webhook.test_sent`
- `template.*` actions (create/update/delete/approve)
- `account.brief.generated`, `account.pushed`, `account.exported`
- `pitch.generated` and `report.generated` (metadata only)

## Admin/operator pages (internal)

These pages are access-controlled via `ADMIN_TOKEN` and set `robots: noindex`.

- `/admin/ops`
- `/admin/run-health`
- `/admin/data-health`
- `/admin/generations`
- `/admin/webhooks`
- `/admin/support`

These views are designed to be compact and safe:
- no secrets
- no raw provider payloads
- no locked premium content by default

