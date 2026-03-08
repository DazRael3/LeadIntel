# Signal momentum timeline

Momentum is the product surface that answers: **“Is this account heating up or cooling off — and what changed?”**

## What it is
- A **deterministic** comparison of current vs prior signal/score windows.
- A compact state label:
  - rising
  - steady
  - cooling
- A short timeline of recent signals and a “most recent high-impact event” callout when available.

## What it is not
- Not a machine-learning chart.
- Not a precision forecast.
- Not a claim of causality (“this caused pipeline”).

## Where it lives in the codebase
- Aggregation: `lib/data/getAccountExplainability.ts`
- Domain types: `lib/domain/explainability.ts`
- UI:
  - `components/account/SignalMomentumCard.tsx`
  - `components/account/SignalMomentumTimeline.tsx`

## UI expectations
- Show current score, prior score, delta, and state label.
- Highlight the most recent high-impact event when present.
- When coverage is thin, default to calm, explicit messaging.

