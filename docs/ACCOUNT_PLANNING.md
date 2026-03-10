# Account planning

LeadIntel’s account planning layer is a **workflow plan recommendation**, not a “deal plan” or a forecasting system.

## What it produces

For an account, the plan includes:

- why this account matters now (timing summary)
- suggested stakeholder/persona path (heuristic, no named contacts)
- a lightweight timeline (now / next / later / wait)
- what is missing or weak
- limitations + confidence band (`limited` / `usable` / `strong`)

## What it does not claim

- no revenue attribution
- no close probability
- no guaranteed sequence
- no buying committee certainty

## APIs

- `GET /api/accounts/:id/plan`
- `GET /api/accounts/:id/touch-plan`
- `GET /api/accounts/:id/pipeline-influence`

## UI

Account planning surfaces render in the account detail view as:

- Account plan card
- Pipeline influence card
- Multi-touch plan card

## Observed vs inferred

Plans clearly separate:

- **observed** signals (events, intent, workflow actions, outcomes)
- **inferred** suggestions (persona path, sequencing guidance)

