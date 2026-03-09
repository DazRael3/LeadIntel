# Command Center mode

Command Center is a focused operating view for daily prioritization and routing.

## Surface

- `/dashboard/command-center`
  - Data source: `/api/dashboard/command-center`
  - Engine: `lib/services/command-center.ts`

## Lanes

Lane placement is derived from **observed workflow statuses** (queue + approvals):

- **Act now**: queue items with `status=ready`
- **Review needed**: queue items requiring manual review + pending approvals
- **Blocked**: queue items `failed` / `blocked`
- **Waiting**: queue items `queued` / `processing`
- **Monitor / stale**: other recent queue activity

## What it does not claim

- Not real-time (no wallboard/stream semantics)
- No cross-workspace aggregation
- No protected message body exposure

