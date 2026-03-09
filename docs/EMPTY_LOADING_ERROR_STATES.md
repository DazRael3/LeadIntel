# Empty/loading/error state system

LeadIntel uses a consistent state taxonomy to avoid “broken” UX perception.

## State categories (preferred vocabulary)

- **no_data_yet**: user has not configured/created required objects (ICP, watchlist, etc).
- **thin_data**: there is data, but not enough coverage to make strong claims.
- **stale_data**: data exists but is outside freshness windows.
- **locked_preview**: free-tier or plan-gated output where full content stays locked.
- **not_configured**: integration is not configured (env missing, not enabled).
- **not_permitted**: user lacks permission/role.
- **not_on_plan**: available only on a higher plan.
- **partial_result**: some sources succeeded; partial output is shown with what’s missing.
- **failed_retryable**: error occurred, user can retry.
- **failed_needs_review**: error occurred and requires admin/operator intervention.

## Implementation pattern

- Prefer shared copy in `lib/copy/leadintel.ts`.
- Prefer reusable state components (e.g. `components/ui/state/StateCard.tsx`) over one-off cards.
- State copy must be calm, specific, and truthful. No blame. No dead ends.

## Safety requirements

- Do not leak secrets or raw provider payloads in error details.
- Locked previews must remain **server-redacted**, not just blurred on the client.
- Failure messages should include safe next steps (retry, upgrade, contact support).

