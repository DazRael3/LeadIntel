# Outcome tracking and learning boundaries

LeadIntel supports **explicit outcome tracking** to inform bounded recommendation nudges.

## Supported outcomes

Outcomes are operator-entered (or recorded by an authorized teammate):

- no outcome yet
- replied
- meeting booked
- qualified
- opportunity created
- not a fit
- wrong timing
- no response
- manual dismissal

## What this does (and does not) mean

- Outcomes can inform **bounded** ranking nudges for similar recommendation classes.
- LeadIntel does **not** claim automatic attribution or causation.

## Storage

Table:

- `api.outcome_records`

RLS:

- workspace members can read
- users can write outcomes (role-gated by workspace intelligence policy where enabled)

## API

- `GET /api/outcomes?accountId=...`
- `POST /api/outcomes`

## UI

- Account detail includes an **Outcome** card for lightweight updates.

