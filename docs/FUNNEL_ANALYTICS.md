# Funnel analytics (events + safety)

LeadIntel tracks a small set of events to understand conversion and activation.

## Principles

- **No generated content** in analytics payloads (no emails, no report markdown, no company-specific generated text).
- **No secrets** or API keys in logs/events.
- Prefer coarse metadata (counts, booleans, surfaces) over detailed payloads.

Client tracking helper:
- `lib/analytics.ts` (`track(eventName, props)`)

When enabled:
- PostHog (client)
- best-effort internal event logging via `POST /api/analytics/track` (auth-only; server writes)

## Top-of-funnel events

- `homepage_cta_sample_clicked`
- `homepage_cta_pricing_clicked`
- `trust_center_cta_clicked`
- `sample_started`
- `sample_completed`

## Activation events

- `onboarding_started`
- `onboarding_completed`
- `target_accounts_added`
- `first_pitch_preview_generated`
- `first_report_preview_generated`
- `first_scoring_explainer_viewed`
- `first_account_tracked`
- `dashboard_activation_checklist_viewed`
- `recent_activity_feed_viewed`

## Upgrade events

- `upgrade_cta_viewed`
- `upgrade_cta_clicked`
- `free_limit_reached` (or surface-specific variants)
- `locked_preview_upgrade_clicked`
- `pricing_checkout_started` (where applicable)

## Depth events (account/workspace)

- `persona_recommendations_viewed`
- `buying_group_viewed`
- `first_party_intent_viewed`
- `signal_momentum_viewed`
- `action_center_variant_generated`
- `account_brief_saved`

