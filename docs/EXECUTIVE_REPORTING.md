# Executive reporting (bounded)

LeadIntel’s executive reporting surfaces are **workflow summaries**, not BI dashboards.

## Surfaces

- **Executive dashboard**: `/dashboard/executive`
  - Data source: `/api/dashboard/executive`
  - Summary engine: `lib/executive/engine.ts`
- **Executive snapshot** (copy/print): “Snapshot” button on `/dashboard/executive`
  - Data source: `POST /api/executive/snapshot`

## What the executive summary includes

All outputs are **metadata-first**, workspace-scoped, and do **not** include protected message bodies.

- Action queue readiness (ready / blocked)
- Approval backlog (pending review)
- Delivery failures (7d) — counts only
- Strategic/named program flag count
- Highlights + risks (bounded list)

## What it does not claim

- No revenue forecast, close probability, or attribution claims
- Not real-time: summaries are derived on request

