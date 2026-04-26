# LeadIntel Production Readiness Audit Report

Date: 2026-04-26  
Branch: `fix/production-readiness-audit`  
Target: `main`  
Environment: Cursor Cloud Linux (validation commands executed with `npm`; Windows-safe `npm.cmd` instructions added in docs)

---

## Summary of Findings

- Dependency risk was reduced from **1 critical / 4 high / 3 moderate** to **0 critical / 0 high / 2 moderate**.
- Production metadata consistency was improved so `/version`, `/api/version`, and `/status` now align on repo/branch/commit/environment fields through a shared version info source.
- Windows-safe production operational instructions were hardened for:
  - `check:production`
  - `db:sanity` (opt-in with `RUN_DB_SANITY=1`)
  - `audit:public`, `audit:doctor`, and `audit:storage` workflows
- Automation health reporting now exposes explicit state labels (`healthy`, `stale`, `missing`, `external`, `disabled`) and a normalized `healthStatus`, with explicit warnings for external scheduler gaps and lifecycle stop limitations.
- Revenue-path test coverage was expanded for:
  - pricing CTA login/checkout behavior
  - capability gating (free/starter vs paid/team)
  - automation health status API
- Logged-in dashboard reliability issue identified from production audit evidence was addressed:
  - **Finding:** `logged_in:/dashboard` triggered `GET /api/lead-activity` HTTP 500 twice and produced console errors.
  - **Fix:** `/api/lead-activity` now returns safe `200` fallback payloads for expected workspace/schema/RLS/unavailable cases, and dashboard UI now renders explicit empty/fallback messaging without throwing.

---

## Files Changed

- `package.json`
- `package-lock.json`
- `app/api/lead-activity/route.ts`
- `app/api/lead-activity/route.vitest.ts` (new)
- `app/dashboard/DashboardClient.tsx`
- `app/dashboard/DashboardClient.test.tsx` (new)
- `app/dashboard/DashboardClient.vitest.tsx`
- `lib/debug/buildInfo.ts`
- `lib/debug/buildInfo.vitest.ts`
- `app/api/version/route.ts`
- `app/api/version/route.vitest.ts`
- `app/(public)/version/page.tsx`
- `app/(public)/status/page.tsx`
- `app/api/public/automation/route.ts`
- `app/api/public/automation/route.vitest.ts` (new)
- `components/Pricing.vitest.tsx`
- `lib/billing/require-capability.vitest.ts` (new)
- `scripts/production-readiness-check.ts`
- `scripts/db-sanity-rls.ts`
- `scripts/auditDoctor.ts`
- `.env.example`
- `README.md`
- `docs/PRODUCTION_ENV.md`
- `docs/AI_AUDIT_RUNNER.md`
- `docs/LAUNCH_CHECKLIST.md`
- `docs/LAUNCH_READINESS_REPORT.md`

---

## Key Changes

### 1) Dependency vulnerability hardening (safe updates, no force)

- Upgraded:
  - `next` from `15.5.10` -> `15.5.15` (intentional patch update)
  - `eslint-config-next` to `15.5.15` (kept aligned with Next)
  - `vite` to `7.3.2`
  - `vitest` to `4.1.5`
  - `@vitest/coverage-v8` to `4.1.5`
  - `postcss` direct dev dependency to `8.5.12`
- Added targeted npm overrides for vulnerable transitives:
  - `protobufjs` `^7.5.5`
  - `flatted` `^3.4.2`
  - `dompurify` `^3.4.1`
  - `brace-expansion` via `minimatch@3.1.5`/`minimatch@9.0.9`
  - `picomatch` via `micromatch`/`anymatch`/`readdirp`
- Result: critical/high vulnerabilities eliminated.

### 2) Version/status consistency

- Introduced shared metadata normalization in `lib/debug/buildInfo.ts`:
  - Vercel metadata first
  - GitHub env fallback (`GITHUB_REPOSITORY`, `GITHUB_REF_NAME`, `GITHUB_SHA`)
  - normalized `repo`, `commitShort`, `deployEnv`, and completeness signals
- `/api/version` now returns:
  - `appEnv`, `nodeEnv`, `deployEnv`, `repo`, `branch`, `commitSha`, `commitShort`
  - no secrets exposed
- `/version` and `/status` now consume aligned version fields and render matching metadata.

### 3) Automation health clarity and scheduler risk signaling

- `/api/public/automation` now returns:
  - per-job `state`: `healthy | stale | missing | failed | external | disabled`
  - summary counts (`healthyJobs`, `externalJobs`)
  - normalized `healthStatus`: `healthy | degraded | stale | missing | external_required`
- Status UI updated to display normalized health wording.
- Existing lifecycle stop limitation warning retained and surfaced as a production risk signal.

### 4) Revenue path test improvements

- `components/Pricing.vitest.tsx`:
  - verifies free CTA points to signup/onboarding
  - verifies unauthenticated checkout CTA redirects to login
  - verifies authenticated checkout CTA posts expected `/api/checkout` payload
- `lib/billing/require-capability.vitest.ts` (new):
  - validates starter lockouts for paid capabilities
  - validates closer/team unlock behavior and team-only gating
- `app/api/public/automation/route.vitest.ts` (new):
  - validates external scheduler-missing path (`external_required`)
  - validates healthy path when required jobs are fresh/successful

### 5) Production/Windows operational docs hardening

- Added/updated Windows PowerShell-safe `npm.cmd` instructions and clarified:
  - `check:production` secrets-safe execution pattern
  - `db:sanity` opt-in behavior (`RUN_DB_SANITY=1`)
  - public vs logged-in audit flow (`audit:public` vs `audit:storage` + `AUDIT_STORAGE_STATE`)
- Added canonical production requirement notes:
  - `NEXT_PUBLIC_SITE_URL` must be exactly `https://raelinfo.com` for production checks.

### 6) Dashboard lead-activity reliability hardening

- Root cause in route behavior:
  - `GET /api/lead-activity` returned `INTERNAL_ERROR` when workspace resolution was unavailable/missing, producing 500 responses on `/dashboard`.
  - Expected Supabase schema/RLS/availability errors inside activity reads could bubble to generic 500 handling.
- API hardening in `app/api/lead-activity/route.ts`:
  - Added explicit expected-error classification for workspace + activity operations (`schema`, `permission/RLS`, transient availability).
  - Added safe fallback response envelope with `summary` + `meta` (`state`, `reason`, `fallback`, `hasWorkspace`, `generatedAt`) and `items: []`.
  - Workspace-missing/bootstrapping and expected Supabase issues now return **200** with empty summary instead of 500.
  - `POST /api/lead-activity` stamp endpoint now fail-softs for expected schema/RLS/unavailable conditions and returns `ok` with `stamped: false, skipped: true`.
  - Structured warning logs now include route/stage/requestId/userId + sanitized error metadata (no secrets/raw internals exposed).
- UI hardening in `app/dashboard/DashboardClient.tsx`:
  - Lead activity fetch parsing is now defensive against malformed payloads and non-2xx responses.
  - Handles unauthorized/forbidden/unavailable/malformed responses without throwing.
  - Always renders a stable card with empty/fallback text: **“No recent lead activity yet.”** for empty/unavailable states.
- Test coverage:
  - `app/api/lead-activity/route.vitest.ts` covers:
    - logged-in user with activity (`200`)
    - logged-in user with no activity (`200` empty)
    - workspace missing (`200` fallback)
    - schema/RLS expected failures (`200` fallback)
    - unexpected errors (`500` safe envelope)
  - `app/dashboard/DashboardClient.test.tsx` covers:
    - empty lead activity payload renders user-friendly empty state
    - unavailable activity API renders safe fallback state without crash

---

## Commands Run

Executed during this audit:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:unit`
5. `npm run check:production` (with safe placeholder env vars in shell)
6. `npm run db:sanity`
7. `AUDIT_BASE_URL="https://raelinfo.com" npm run audit:public`
8. `AUDIT_BASE_URL="https://raelinfo.com" npm run audit:doctor`
9. `npm audit`
10. `git status`

Executed for dashboard reliability fix:

1. `npm run test:unit -- app/dashboard/DashboardClient.test.tsx app/api/lead-activity/route.vitest.ts`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:unit`
5. `AUDIT_BASE_URL="https://raelinfo.com" AUDIT_SCOPE="all" AUDIT_STORAGE_STATE="admin-reports/ai-site-audit/storageState.json" npm run audit:ai`
6. `npm audit`
7. `git status`

Focused verification commands also run during implementation:

- `npm run test:unit -- app/api/version/route.vitest.ts app/api/public/automation/route.vitest.ts components/Pricing.vitest.tsx lib/billing/require-capability.vitest.ts lib/debug/buildInfo.vitest.ts`

---

## Test Results

- `typecheck`: **pass**
- `lint`: **pass**
- `test:unit`: **pass**
  - 199 files, 728 passed, 1 skipped
- `check:production`: **pass** (using safe placeholder env vars; no secret values printed)
- `db:sanity`: **pass/skip expected** (`RUN_DB_SANITY!=1, skipping`)
- `audit:public`: **pass**
  - 101 public routes discovered and audited
  - no route failures in run output
- `audit:doctor`: **WARN (expected)**
  - warning is only for missing `AUDIT_STORAGE_STATE` for logged-in/all scope
  - public audit remains valid without storage state
- `audit:ai` (post-fix rerun command with scope `all`): **blocked in this cloud run**
  - command was executed with the requested env vars, but `admin-reports/ai-site-audit/storageState.json` did not exist in this environment (`ENOENT`)
  - attempted recovery via `npm run audit:storage` also blocked because manual browser login capture timed out in unattended cloud execution
  - **Action required:** capture storage state in an interactive session and rerun full logged-in audit to confirm production `/dashboard` no longer emits `/api/lead-activity` 500s

---

## npm Audit Before / After

| Stage | Critical | High | Moderate | Total |
|---|---:|---:|---:|---:|
| Before changes | 1 | 4 | 3 | 8 |
| After changes | 0 | 0 | 2 | 2 |

Remaining advisories:

- `postcss` under `next` bundled dependency tree (`next/node_modules/postcss`) reported as moderate by npm advisory resolution.
- Current npm suggested fix path is an invalid breaking downgrade recommendation (`next@9.3.3`), so remediation is deferred pending upstream advisory/package resolution in a future safe Next.js patch.

---

## Revenue Path Verification (Pass/Fail)

| Area | Status | Evidence |
|---|---|---|
| Pricing CTA -> signup/checkout | PASS | `components/Pricing.vitest.tsx`, `app/api/checkout/route.vitest.ts` |
| Lead capture insert success | PASS | `app/api/lead-capture/route.vitest.ts` |
| Follow-up email configured path | PASS | `app/api/lead-capture/route.vitest.ts` |
| Admin notification configured path | PASS | `app/api/lead-capture/route.vitest.ts` |
| Stripe checkout verification | PASS | `app/api/billing/verify-checkout-session/route.vitest.ts` |
| Stripe webhook idempotency | PASS | `app/api/stripe/webhook/route.vitest.ts` |
| Subscription tier persistence | PASS | verify-checkout + webhook tests |
| `/api/plan` correct tier after checkout | PASS | verify-checkout session integration test + `app/api/plan/route.vitest.ts` |
| Starter/free blocked from paid features | PASS | `lib/billing/require-capability.vitest.ts`, `app/api/unlock-lead/route.vitest.ts` |
| Paid tiers unlock correct capabilities | PASS | `lib/billing/capabilities.vitest.ts`, `lib/billing/require-capability.vitest.ts` |

---

## Remaining Risks

1. **Moderate npm advisory residual (Next-internal PostCSS tree)**  
   No safe semver patch path provided by npm audit output beyond current intended Next.js patch track.

2. **Lifecycle stop behavior limitation**  
   Lifecycle disqualification stop is not fully implemented at user-state lifecycle level (explicitly surfaced in automation warnings).

3. **External scheduler dependency**  
   Some required production automations depend on external scheduler wiring and can become stale/missing if external jobs are not configured/monitored.

---

## Manual Production Checks Still Required

1. Run logged-in/full audit flow on Windows PowerShell:
   - `npm.cmd run audit:storage`
   - set `AUDIT_STORAGE_STATE`
   - run full `audit:ai -- --scope=all`
   - verify post-fix result: `logged_in:/dashboard` has 0 console errors and no `/api/lead-activity` 500 failures
2. Run real `db:sanity` in production-like shell with real credentials and `RUN_DB_SANITY=1`.
3. Verify `/status`, `/version`, and `/api/version` on live site all show consistent metadata for current deployment.
4. Confirm external scheduler jobs are configured and produce fresh `job_runs` entries for required external jobs.
5. Validate end-to-end Stripe live checkout + webhook in production environment.

---

## Acceptance Criteria Checklist

- [x] Critical/high dependency vulnerabilities removed (0 critical, 0 high).
- [x] No blind `npm audit fix --force` used.
- [x] Next.js not upgraded to 16; React not upgraded to 19.
- [x] Production env verification docs improved (Windows-safe, no secrets printed).
- [x] DB sanity instructions improved with PowerShell guidance.
- [x] Logged-in audit flow messaging clarified (`audit:doctor` + `audit:storage` usage).
- [x] Revenue path test coverage expanded.
- [x] `/version`, `/api/version`, `/status` metadata alignment improved.
- [x] Automation health reporting clarified with scheduler state categories.
- [x] Lifecycle stop limitation documented as production risk.
