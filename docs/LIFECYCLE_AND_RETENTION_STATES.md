# Lifecycle and retention states

LeadIntel derives **bounded workflow lifecycle states** for growth ops visibility. These are **heuristics**, not churn prediction.

## Lifecycle states (current)

Implemented in `lib/services/lifecycle-state.ts`:

- `signed_up`
- `onboarding_started`
- `activated`
- `at_risk`
- `dormant`

Additional states exist in the type model but may remain `0` until the corresponding signals are instrumented:

- `adopting`
- `team_adopting`
- `expansion_candidate`

## Retention signals (current)

Implemented in `lib/services/retention-signals.ts`:

- Recent activity in the last 7 days (based on `api.growth_events`)
- Low recent activity warning when no events were recorded

## Guardrails

- These states **must never** be used to gate entitlements or restrict access.
- They must remain explainable and derived from observed product state/events.

