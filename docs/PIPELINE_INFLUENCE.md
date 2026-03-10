# Pipeline influence (bounded)

LeadIntel’s pipeline influence model is **workflow-oriented** and intentionally bounded.

## Influence labels

- `unknown`
- `early_influence`
- `building`
- `high_attention`
- `confirmed_progression`

## What “confirmed progression” means

Only when an explicit outcome is recorded (for example `meeting_booked`, `qualified`, or `opportunity_created`).

## What it does not mean

- not revenue attribution
- not forecasting
- not claiming causation

## Data sources used

Observed signals such as:

- first-party intent summary (when present)
- momentum label/delta
- action queue and delivery activity
- explicit outcomes entered by users

## API

- `GET /api/accounts/:id/pipeline-influence`

