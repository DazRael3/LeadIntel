# Recommendation feedback

LeadIntel captures lightweight feedback to improve recommendation usefulness **without** pretending to be a self-learning black box.

## What gets captured

Feedback is an explicit event with:

- workspace scope
- actor user
- target type/id
- recommendation type + version
- feedback kind (useful / not useful / wrong timing / etc.)
- optional comment (stored, not sent to analytics)

## Storage

Table:

- `api.recommendation_feedback`

Row Level Security:

- workspace members can read
- users can write their own feedback

## API

- `POST /api/recommendations/feedback`

## Audit + analytics

- audit: `recommendation.feedback_submitted` (no comment text)
- analytics: `recommendation_feedback_submitted` (no comment text)

