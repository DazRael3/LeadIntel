# Website polish gap list (high-ROI, tight scope)

This is a short, actionable checklist for the **public-site polish pass**. It focuses on the highest-leverage “still visible” gaps: internal-feeling labels, route continuity, and buyer-facing refinement—without redesigns or big rewrites.

## P0 — Use Cases (highest priority)

- **`/use-cases`**: “Workflow types” shows raw route strings (e.g. `/dashboard`, `/settings/templates`) which reads internal.
  - **Fix**: Replace route-text links with customer-facing labels (keep destinations), and add a small “Next steps” set linking to `/tour`, `/compare`, `/trust`, `/pricing`.
  - **Files**: `app/(public)/use-cases/page.tsx`
  - **Type**: copy, CTA, route continuity

- **`/use-cases/*` detail pages**: Analytics event name drift (`use_case_view` vs desired `use_case_viewed`).
  - **Fix**: Normalize page-view events to `use_case_viewed`.
  - **Files**: `app/(public)/use-cases/*/page.tsx`
  - **Type**: analytics

## P1 — Homepage cleanup (targeted only)

- **`/`**: Public homepage client component still contains logged-in data fetching (trigger events, quick stats) and renders a local header (competes with global nav).
  - **Fix**: Remove the internal/tenant data reads and local header; keep the premium marketing sections. Add minimal CTA click tracking for primary/secondary CTAs.
  - **Files**: `app/LandingClient.tsx`
  - **Type**: layout, copy/CTA, analytics

## P1 — Trust / Version / Status / Support refinement

- **`/version`**: Uses wrong analytics event (`trust_center_viewed`) and presents repo/branch/full SHA too prominently for a buyer-facing page.
  - **Fix**: Track `version_page_viewed`. Present “Release” info as buyer-readable (short SHA) and keep implementation details secondary.
  - **Files**: `app/(public)/version/page.tsx`
  - **Type**: copy/layout, analytics

- **`/status`**: Includes admin-only links (`/admin/ops`) and multiple raw endpoint links in primary content.
  - **Fix**: Remove admin link from public status. Keep raw endpoints clearly labeled as debug/technical, not primary navigation.
  - **Files**: `app/(public)/status/page.tsx`
  - **Type**: route/copy, trust polish

- **`/support`**: Advises visiting a raw API route (`/api/plan`) as user-facing guidance.
  - **Fix**: Replace with buyer-safe instructions (“Manage billing”, refresh, re-login) without directing to raw API.
  - **Files**: `app/(public)/support/page.tsx`
  - **Type**: copy/trust

## P2 — Compare / Tour polish (no rebuild)

- **`/compare` + `/compare/*`**: Analytics event naming drift (hub/detail). Ensure consistent “compare page viewed” event and strengthen cross-links to `/use-cases`, `/trust`, `/pricing`, `/tour`.
  - **Fix**: Normalize to `compare_page_viewed` with `kind: 'hub' | 'detail'`.
  - **Files**: `app/(public)/compare/page.tsx`, `app/(public)/compare/[slug]/page.tsx`
  - **Type**: analytics, route continuity

- **`/tour`**: Analytics event name drift vs desired `tour_preview_viewed`.
  - **Fix**: Normalize event and ensure Next steps link set includes `/use-cases` + `/trust` (in addition to pricing/templates/sample).
  - **Files**: `app/(public)/tour/page.tsx`
  - **Type**: analytics, CTA continuity

## P2 — Nav / Footer / route continuity

- **Footer**: “Email preferences” links to an internal settings route (reads like an internal destination in public shell).
  - **Fix**: Point to a public support anchor and keep the in-app path as secondary guidance.
  - **Files**: `components/SiteFooter.tsx`, `app/(public)/support/page.tsx`
  - **Type**: CTA/copy, route continuity

## P2 — Minimal metadata + regression tests

- **Metadata**: Add canonical alternates where missing (not a full SEO rewrite).
  - **Files**: `app/(public)/use-cases/page.tsx` (and any page missing canonical)
  - **Type**: metadata

- **Regression tests**: Add a small Playwright spec to lock in:
  - Use-cases hub does **not** render raw route-style CTAs
  - Footer trust/version links resolve and `/version` is human-readable
  - Pricing still includes preview-accurate Free/Starter language
  - **Files**: `tests/e2e/*`
  - **Type**: tests

