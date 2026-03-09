# Account coverage

LeadIntel’s account coverage layer is **workflow-oriented**. It helps teams answer:

- Who owns this account (in LeadIntel’s workflow)?
- Is coverage healthy or stale?
- Is ownership overlapping or missing?
- What should happen next?

This is **not** a CRM replacement and does not claim CRM territory sync.

## Coverage states

- owned and active
- owned but stale
- unowned
- blocked
- overlapping ownership
- monitor only
- expansion watch
- strategic focus

## Data sources (observed)

- action queue items and statuses (`api.action_queue_items`)
- assignment fields on queue items (`assigned_to_user_id`)
- program flags (`api.account_program_accounts`)
- account explainability signals (momentum, intent, data quality)

## API

- `GET /api/accounts/:id/coverage`
- `PATCH /api/accounts/:id/coverage` (privileged roles only; sets program state)

## UI

Rendered on the account view:

- Coverage summary card
- Ownership routing card

