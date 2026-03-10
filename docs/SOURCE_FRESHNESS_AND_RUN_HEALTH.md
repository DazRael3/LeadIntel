# Source Freshness and Run Health

This wave adds user-facing freshness summaries and admin/operator run-health visibility.

## User-facing freshness

Account detail includes:

- **Source freshness** (`SourceFreshnessCard`): latest signal timestamp, latest first-party visit timestamp (when present), and a coarse freshness label.
- **Data quality** (`DataQualityCard`): coverage and limitations summary.

These summaries are derived from **stored trigger events** and **domain-matched website visitor rows**. They do not require service-role access and do not expose internal snapshot payloads.

## Admin/operator run health

Admin-only pages require `ADMIN_TOKEN` via `?token=...` and are marked `robots: noindex`.

- `app/admin/run-health/page.tsx`
  - Usage ledger volume (pitches/reports completed)
  - Export job statuses
  - Webhook delivery statuses and retry backlog due
  - Automation job runs (from `api.job_runs`)

- `app/admin/data-health/page.tsx`
  - Tracked accounts count
  - Signals + website visitor ingestion volume
  - Company snapshot fetched/error volume (last 24h) by source type

## Tables involved

- `api.job_runs` (service-role only; RLS denies auth/anon)
- `api.export_jobs` (workspace-scoped via RLS)
- `api.webhook_endpoints`, `api.webhook_deliveries` (workspace-scoped via RLS; deliveries insert/update server-side)
- `api.company_source_snapshots` (service-role only; internal)

