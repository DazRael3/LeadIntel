# Conversion science (event model)

LeadIntel treats growth measurement as an **operational signal**, not a source of “guaranteed uplift” claims.

## Event sources

- **Client tracking**: `lib/analytics.ts` (`track(...)`)
  - Sends to PostHog when enabled
  - Also posts to `/api/analytics/track` (auth required)

- **Workspace-scoped growth events**: `api.growth_events`
  - Written by `/api/analytics/track` for a bounded allowlist (`lib/growth-events/*`)
  - Payloads are sanitized (no nested objects; string truncation)
  - Intended for **internal growth ops visibility**, not user-facing reporting

## Core funnel milestones (examples)

These are captured when emitted by the UI:

- `onboarding_started`
- `target_accounts_added`
- `first_pitch_preview_generated`
- `first_report_preview_generated`
- `pricing_cta_clicked`
- `upgrade_clicked`
- `dashboard_activation_checklist_viewed`
- `checklist_step_clicked`

## Experiment attribution

For metrics that need per-variant breakdown, the UI includes:

- `experimentKey`
- `variantKey`
- `surface`

in the event props (sanitized) where appropriate.

## What we do not claim

- No statistical significance claims by default.
- No causal uplift claims.
- No “AI automatically optimizes conversion” behavior.

