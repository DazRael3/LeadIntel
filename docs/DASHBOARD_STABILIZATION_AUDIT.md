# Dashboard stabilization audit (request graph + gating)

Goal: make the logged-in dashboard **entitlement-aware and calm**, especially for **Starter/preview** users, by stopping unauthorized/background requests and tightening module visibility.

## Current request graph (as implemented)

### Dashboard root
- **`app/dashboard/page.tsx`**
  - Reads user + plan (`getPlan`) and `user_settings` and passes initial props to `DashboardClient`.
  - **Note**: Plan model is `plan: 'free' | 'pro'` and tier labels are fetched client-side via `PlanProvider` (`/api/plan`).

### Client boot (always mounts today)
- **`components/PlanProvider.tsx`**
  - **Fetch**: `GET /api/plan` on mount to derive `tier` (`starter|closer|closer_plus|team`) and trial.

- **`app/dashboard/DashboardClient.tsx`** (current)
  - **Fetch**: `POST /api/lifecycle/ensure` on initial effect (best-effort) (duplicates login/onboarding triggers).
  - **Supabase reads**:
    - `useCredits` (`app/dashboard/hooks/useCredits.ts`): reads `api.users.credits_remaining` and **writes** a daily reset (`UPDATE api.users`) when day changes.
    - `useStats` (`app/dashboard/hooks/useStats.ts`): counts `api.leads` (for “Total Leads”).
    - `useTriggerEvents` (`app/dashboard/hooks/useTriggerEvents.ts`): reads `api.trigger_events` (filtered by user and optional company context).

### Command Center tab modules (mounted regardless of active tab today)
- **Activation**
  - **Fetch**: `GET /api/activation-v2` via `components/dashboard/useActivationV2.ts`
  - Mounted by `components/dashboard/GettingStartedRail.tsx` + `components/dashboard/ActivationChecklist.tsx`

- **Recent activity**
  - **Fetch**: `GET /api/activity/recent` via `components/dashboard/RecentActivityFeed.tsx`

- **Action queue**
  - **Fetch**: `GET /api/workspace/actions/queue?...` via `components/dashboard/ActionQueueCard.tsx`
  - **Server gate**: Team-only (`requireTeamPlan`) in `app/api/workspace/actions/queue/route.ts`
  - Current UI behavior: calls anyway, then hides itself on 403 (still produces noisy background request).

- **Market sidebar**
  - **Fetch**: `POST /api/market/quotes` (quotes polling) via `components/MarketSidebar.tsx` → `lib/market/prices.ts`
  - **Also**: `useMarketWatchlist` (may call additional endpoints / storage depending on implementation)

### Other dashboard tabs (mounted even when inactive today)
Because Radix Tabs content is mounted and merely hidden, these modules can still execute effects:
- **Website Visitors** (`components/WebsiteVisitors.tsx`)
  - Supabase `select * from website_visitors`
  - Realtime subscription `postgres_changes` on `api.website_visitors`
  - This is a common source of 403/500 spam when the table/RLS/realtime isn’t enabled for Starter accounts.

- **Live Intent / Market Pulse / Watchlist**
  - Wrapped in `ProGate`, but **`ProGate` currently renders children even when locked** (blurred), so locked tabs can still run requests.

## Primary sources of noisy 403/500 spam (Starter/preview)

1) **Inactive tab mounting**: tabs mount in background, so their data hooks fire even if user never opens them.
2) **`ProGate` mounting locked children**: gated modules still mount and request.
3) **Team-only modules called for Starter**: `ActionQueueCard` calls a Team-only API then hides on 403 (request spam).
4) **Writes from Starter dashboard**: `useCredits` attempts DB updates for daily reset; `POST /api/lifecycle/ensure` runs on dashboard load.

## Fix strategy (high-ROI, minimal churn)

- **Mount-on-active**: only mount the active tab’s content (no background requests from hidden tabs).
- **Policy-driven tabs/modules**: a small dashboard policy map drives:
  - tab visibility (show vs locked vs hidden)
  - whether fetch is allowed for a module
- **No locked previews that mount**: Starter locked modules show a calm locked state without mounting the underlying component.
- **Remove dashboard-level lifecycle ensure**: keep lifecycle ensure at login/onboarding, not on every dashboard render.
- **Avoid Starter writes** from the dashboard shell: no DB resets in client hooks; rely on server-side or explicit user actions.

## Key files to change (implementation targets)
- `app/dashboard/DashboardClient.tsx` (tabs + gating + request discipline)
- `components/ProGate.tsx` (optional: add a non-mount mode; dashboard can avoid using it)
- `components/dashboard/ActionQueueCard.tsx` (add enable/locked behavior; avoid background 403)
- `components/WebsiteVisitors.tsx` (gate by tier; avoid realtime subscription for Starter)
- `app/dashboard/components/StatsBar.tsx` (remove broken “Companies: -” placeholder)
- `app/dashboard/components/DashboardHeaderSection.tsx` + `components/DashboardHeader.tsx` (nav crowding + internal-feeling copy)

