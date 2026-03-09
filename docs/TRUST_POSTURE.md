## Purpose

This document defines LeadIntel’s **trust posture** as represented in the Trust Center and adjacent conversion surfaces (pricing, upgrade callouts, compare pages).

It is designed to prevent accidental over-claims while still giving larger buyers a clear, operator-grade view of what’s implemented.

## Public surface area

- Trust Center: `app/(public)/trust/page.tsx`
  - “What larger teams usually ask about”: `components/marketing/TrustChecklist.tsx`
  - “Current trust posture” + boundaries: `components/marketing/BuyerReadiness.tsx`
- Supporting pages (linked from `/trust`): `/security`, `/privacy`, `/terms`, `/acceptable-use`, `/subprocessors`, `/dpa`, `/status`, `/version`, `/changelog`, `/roadmap`

## What we can claim (because the product implements it)

Keep claims high-level and tied to mechanics:

- **Workspace isolation + access control**: data boundaries are scoped to authenticated identity/workspace.
- **Row-level security expectations**: database access is policy-controlled; do not describe bypass paths.
- **Server-side secrets**: private keys and secrets stay server-side; do not log or expose them.
- **Rate limiting**: public and authenticated routes have guardrails.
- **Structured logging + request IDs**: operational observability exists without logging secrets.
- **Billing processors**: Stripe for billing; Supabase for auth/database.
- **Operational handoff**: webhooks/exports are designed as explicit action surfaces.
- **Team governance (where applicable)**: template approval and audit visibility exist on Team-gated surfaces.

## What we must NOT claim unless explicitly true

Do not claim or imply any of the following unless we have implemented them and the Trust Center copy explicitly states it:

- SOC 2
- ISO 27001
- SSO / SAML
- SCIM
- “Enterprise-grade” controls we do not actually ship

If a buyer asks, the correct posture is: **“not generally available today”** + **what we do have** + **what we can discuss**.

## Boundaries that must be explicit

- LeadIntel is **not** a general-purpose contact database.
- People/buying-group surfaces are **persona-level recommendations** (heuristic, signal-based) and do not invent named contacts.
- First-party intent is shown **only when observed** and matched; otherwise we show an explicit empty state.

## Change policy

When updating Trust Center content:

- Prefer referencing existing public pages and real, inspectable behavior.
- Avoid implementation details that could create security risk or invite misuse.
- Never add sensitive operational details (key formats, internal endpoints, etc.).
- Keep copy calm and buyer-grade; no urgency or fear language.

# Trust posture (public and buyer-ready)

LeadIntel’s Trust Center is designed for buyers who verify. It avoids overclaims.

## Trust Center index
Route: `/trust` (`app/(public)/trust/page.tsx`)

Links to:
- Security
- Privacy
- Terms
- Acceptable Use
- Subprocessors
- DPA
- Status
- Version
- Changelog
- Roadmap

## What larger teams usually ask about
Component: `components/marketing/TrustChecklist.tsx`

This is a procurement-oriented checklist covering:
- data boundaries
- tenant isolation and access controls
- audit visibility
- exports/webhooks behavior
- secret handling boundaries
- rate limiting
- deletion/support paths

## Current trust posture
Component: `components/marketing/BuyerReadiness.tsx`

This section makes clear:
- what’s in place today (tenant isolation, server-side secrets, rate limiting, structured logging, Stripe billing)
- what is not claimed (e.g., SOC 2/ISO certifications, SSO/SAML/SCIM) unless explicitly implemented and stated

## Analytics
- `trust_center_viewed`: page view
- `trust_readiness_viewed`: fired when the “larger teams” checklist becomes visible

