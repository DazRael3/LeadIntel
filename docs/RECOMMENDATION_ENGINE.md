# Recommendation engine

LeadIntel’s recommendation layer is designed to be:

- **explainable**
- **auditable**
- **feedback-informed (bounded)**
- **honest when data is thin**

This is intentionally **not** framed as “model retraining” or a black-box predictor.

## Architecture

Core modules:

- `lib/recommendations/types.ts`: canonical types for recommendation payloads, feedback, outcomes
- `lib/recommendations/engine.ts`: deterministic engine + bounded learning nudges
- `lib/recommendations/confidence.ts`: confidence band derivation (`limited` / `usable` / `strong`)
- `lib/recommendations/features.ts`: stable feature fingerprint for delta explanations
- `lib/recommendations/explanations.ts`: human-readable reason summaries
- `lib/recommendations/feedback.ts` + `lib/recommendations/outcomes.ts`: bounded adjustment logic

## What inputs are used

Recommendations are built from the account’s explainability bundle:

- base explainable score
- momentum label/delta
- first-party intent summary (when available)
- data quality + freshness
- persona recommendations

## Learning boundaries (no overclaims)

When enabled, workspace feedback/outcomes can **nudge** priority:

- adjustments are bounded (no large swings)
- no causation or attribution claims
- all outputs remain explainable

Workspace admins can control adaptive behavior in:

- `/settings/intelligence`

## API

Account recommendation bundle:

- `GET /api/accounts/:accountId/recommendations`

Feedback capture:

- `POST /api/recommendations/feedback`

Outcome capture:

- `GET/POST /api/outcomes`

## Data safety

- No secrets are included in recommendation payloads
- No generated premium body text is logged into analytics events
- Audit entries record action types and IDs, not sensitive payloads

