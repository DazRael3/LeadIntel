# 2026-03-31 — Tier & public-site audit summary (from attached artifacts)

Source artifacts: `uploads/REPORT.md`, `uploads/metadata.json`, `uploads/routes.json`, `uploads/console-errors.json`, `uploads/network-failures.json`, `uploads/heuristics.json`.

This summary is a senior-level interpretation focused on **tier correctness**, **UI gating vs server enforcement**, and **production deployment readiness**.

## Executive summary

- **Public buyer journey**: 99 public routes audited; **all returned HTTP 200** with consistent canonicals and titles.
- **Logged-in surfaces**: 21 logged-in routes audited; **all returned HTTP 200**.
- **Top issues**:
  - **HIGH**: logged-in home (`logged_in:/`) recorded a **429** from `GET /api/public/email-config`, plus a console error for the 429. This is a real production UX issue (even if non-fatal).
  - **HIGH**: logged-in Support (`logged_in:/support`) recorded `PlanProvider: Error refreshing plan: TypeError: Failed to fetch` (console error).
  - **Tier/claims drift**: “Daily shortlist” is marketed as a **Closer** feature in pricing, but dashboard copy states **Team-only**.
  - **Tier copy drift**: multiple Team-gated pages show **“Locked on Closer”** but the CTA says **Upgrade to Team**.

## Tier-by-tier observations (from audit evidence)

### Starter
- **Verified**:
  - Public “try sample digest” + template library routes exist and return 200.
- **Not verified by this artifact set**:
  - Starter preview generation limits / counters (the artifacts don’t include POST outcomes or usage caps).

### Closer
- **Claimed (pricing)**: daily shortlist + scoring + drafts + unlimited competitive reports.
- **Observed (logged-in dashboard headings)**:
  - A dashboard heading explicitly says **“Daily shortlist is Team-only”**.
- **Risk**: This is a **pricing/positioning mismatch** *or* a mis-gated feature surface.

### Closer+
- The artifact set doesn’t contain explicit “Closer+ only” deltas (e.g., freshness/source visibility) beyond pricing page headings.

### Team
- Multiple governance pages appear Team-gated (templates/integrations/sources/workspace/etc).
- **Copy issue**: These pages show **“Locked on Closer”** even though they are positioned as Team features (CTA “Upgrade to Team”).

## Issues and recommended changes (no code changes included here)

### 1) Tier definition drift: “Daily shortlist” Closer vs Team-only
- **Severity**: HIGH (revenue + trust)
- **Evidence**:
  - Pricing copy includes “Daily shortlist for your watchlist” under Closer.
  - Dashboard copy says “Daily shortlist is Team-only”.
- **Likely cause**: gating predicate (`tierAtLeast(tier, 'team')`) + copy not aligned with pricing.
- **Recommended change**:
  - Decide the canonical entitlement:
    - If **Closer should have shortlist**: change dashboard gating/capability for shortlist surfaces from Team-only to Closer (and ensure server-side API enforcement matches).
    - If **Team-only is correct**: update pricing/marketing copy to remove “Daily shortlist” from Closer and reposition accordingly.

### 2) Team-gated pages labelled “Locked on Closer”
- **Severity**: MEDIUM (conversion + confusion)
- **Evidence**: `logged_in:/dashboard/actions`, `/dashboard/command-center`, `/dashboard/executive`, `/settings/templates`, `/settings/integrations`, `/settings/sources`, `/settings/workspace` show headings “Locked on Closer”, but CTA is “Upgrade to Team”.
- **Likely cause**: shared gate component using an older label (“Closer”) while product tier is now “Team” for those surfaces.
- **Recommended change**:
  - Update the lock-state copy to match the actual upgrade target (Team) and/or show the required capability.

### 3) Logged-in homepage hits 429 for `/api/public/email-config`
- **Severity**: HIGH (runtime UX + monitoring noise)
- **Evidence**: `network-failures.json` records `logged_in:/` → `GET /api/public/email-config` status **429**, and `console-errors.json` includes the corresponding console error.
- **Likely cause**: client repeatedly calling email-config endpoint (or shared browsing behind a NAT), exceeding `x-ratelimit-limit: 30` per minute.
- **Recommended change**:
  - Cache the email-config result client-side more aggressively (session/localStorage) and/or raise the limit, and/or make logged-in pages not call this endpoint.
  - Ensure UI behaves gracefully when email-config is rate-limited (avoid console errors).

### 4) Support page console error: Plan refresh “Failed to fetch”
- **Severity**: HIGH (runtime UX + potential plan gating correctness)
- **Evidence**: `console-errors.json` contains `PlanProvider: Error refreshing plan: TypeError: Failed to fetch` on `logged_in:/support`.
- **Likely cause**: `/api/plan` request failing due to transient network, blocked cookies, or guard/origin enforcement in that context.
- **Recommended change**:
  - Treat plan refresh as best-effort with backoff and suppress noisy console errors in production (log via observability instead).
  - Confirm `/api/plan` is accessible from `/support` in authenticated sessions.

## Production deployment readiness (non-code guidance)
- Before full production deployment, resolve **Tier definition drift** (#1) and eliminate **429/plan-refresh console errors** (#3/#4) to avoid shipping visible “broken” signals on logged-in routes.

