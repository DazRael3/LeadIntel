# Support Debugging Guide (Metadata-first)

LeadIntel’s support tooling is designed to help operators debug issues **without exposing premium content** by default.

## Admin support context page

- Route: `/admin/support?token=...`
- Lookup by:
  - `userId` (UUID)
  - `email`

The page returns a compact support “packet”:

- entitlement tier (resolved from DB/subscription state)
- usage ledger counts (pitches/reports complete, active reservations, cancellations)
- recent usage events (no content)
- recent reports (id/status/kind/title)
- recent exports (id/status/type/error truncated)

## What this is NOT

- It does not show full pitch/report bodies.
- It does not show webhook secrets or raw payloads.
- It is not a public-facing health dashboard.

## Typical workflows

- **User says “I’m stuck at limit”**
  - Check usage ledger counts and active reservations.
  - Look for cancelled reservations spikes.

- **User says “exports keep failing”**
  - Check recent export jobs + failure messages (truncated).
  - Cross-check audit log for `export.failed`.

- **User says “webhooks didn’t fire”**
  - Check endpoint status and recent deliveries in `/admin/webhooks`.
  - Check delivery backlog due (run health).

