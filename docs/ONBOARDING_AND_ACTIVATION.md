# Onboarding and Activation (v2)

LeadIntel’s activation layer is designed to get a new user to first value quickly **without** pretending to be a generic CRM or contact database.

## Goals

Onboarding drives a user to:
- add targets (accounts)
- generate a first preview (pitch or report)
- understand the deterministic score
- see the operational loop in the dashboard (why-now → draft → action)

It remains **skippable**, and it persists progress so the user can resume later.

## Onboarding flow (app route)

Route: `app/onboarding/page.tsx`

Steps (UI labels are user-facing; stored values are keys):
1. **Choose goal** (`api.user_settings.primary_goal`)
   - Track target accounts
   - Generate outreach faster
   - Build a daily shortlist
   - Evaluate competitive accounts
2. **Add targets** (writes to `api.leads`)
   - Accepts company names, domains, or URLs
   - Domains/URLs enable stronger first-party matching; names are allowed when coverage is thin
3. **Pick workflow** (`api.user_settings.onboarding_workflow`)
   - Pitch workflow
   - Report workflow
   - Daily shortlist workflow
4. **First result**
   - Routes to `/pitch?auto=1&url=...` or `/competitive-report?auto=1&url=...`
5. **Next best action**
   - Encourage repeat generation + saving + action layer usage
   - Provide calm links to pricing and trust center

Progress persistence:
- `api.user_settings.onboarding_v2_step` (1–5)
- `api.user_settings.onboarding_workflow` (`pitch` | `report` | `daily_shortlist`)
- `api.user_settings.onboarding_started_at`
- `api.user_settings.onboarding_completed` (set true when finishing or explicitly skipping)

Migration:
- `supabase/migrations/0012_onboarding_v2_state.sql`

## Activation dashboard layer

The dashboard surfaces activation state without leaking locked content:
- `components/dashboard/GettingStartedRail.tsx`
- `components/dashboard/ActivationChecklist.tsx`
- `components/dashboard/ValueMomentsCard.tsx`
- `components/dashboard/RecentActivityFeed.tsx`
- `components/dashboard/UpgradeReasonsCard.tsx` (Starter-only, conditional)

API:
- `GET /api/activation-v2` (`app/api/activation-v2/route.ts`)
- `GET /api/activity/recent` (`app/api/activity/recent/route.ts`)

Activation stamps (best-effort, authed only):
- `api.user_settings.pricing_viewed_at`
- `api.user_settings.trust_viewed_at`
- `api.user_settings.scoring_viewed_at`
- `api.user_settings.templates_viewed_at`

Migration:
- `supabase/migrations/0022_activation_tracking_fields.sql`

## Notes on “first value”

LeadIntel treats “first value” as **a usable operator output**, not just a click:
- a generated pitch preview
- a saved competitive report
- a tracked account in the workspace
- a saved account brief (paid tiers)

