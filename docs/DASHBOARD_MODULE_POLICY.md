# Dashboard module policy (visibility + request gating)

Dashboard modules must be driven by a single policy source so **visibility** and **data fetching** stay aligned.

## Policy source
- **`lib/dashboard/policy.ts`**
  - `getDashboardTabs({ tier, entitlements })`: tab rail visibility by tier
  - `getModulePolicy({ tier, module })`: module mount/fetch eligibility

## Core rules
- **Inactive tabs must not mount**: only active tab content is rendered.
- **Locked modules must not mount**: locked state is rendered without mounting requestful components.
- **Team-only endpoints must be gated in UI**: do not “try then hide on 403”.

## Current module requirements

### Tabs
- Starter: `command`, `leads`, `settings`
- Paid tiers: include visitors/intent/market/watchlist

### Modules
- `action_queue`
  - **Required tier**: `team`
  - **Rationale**: server gate in `app/api/workspace/actions/queue/route.ts` uses `requireTeamPlan`

- `market_sidebar`
  - **Required tier**: `closer` (and above)
  - **Rationale**: avoid non-essential market polling + watchlist queries on Starter

- `website_visitors`
  - **Required tier**: `closer` (and above)
  - **Rationale**: uses realtime + `website_visitors` table; can be unavailable per environment/workspace

## How to add a module
1) Add a new `module` key to `getModulePolicy`
2) Use the returned policy to decide:
   - whether to render the module at all
   - whether to render a **locked** card (no mounting)
3) Update `docs/DASHBOARD_EMPTY_AND_LOCKED_STATES.md` with the chosen copy/state

