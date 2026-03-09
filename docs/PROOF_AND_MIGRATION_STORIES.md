## Purpose

This document defines what “proof” and “migration stories” mean in LeadIntel marketing surfaces, and how we keep them truthful, inspectable, and tied to real product mechanics.

## Where this content lives in the product

- `components/marketing/ProofLayer.tsx`: “Why LeadIntel feels different in practice”
- `components/marketing/CapabilityProofGrid.tsx`: proof items tied to mechanics
- `components/marketing/MigrationStories.tsx`: “Common switching paths” (pattern-based narratives)
- The homepage (`app/LandingClient.tsx`) renders both sections for logged-out visitors.

## Proof principles (non-negotiable)

- **Proof must map to real mechanics**: scoring explainability, momentum visibility, persona recommendations, first-party intent (when observed), action packaging, templates governance, webhook/export handoff, trust-center visibility.
- **No fabricated social proof**: no fake logos, testimonials, case studies, metrics, review badges, or “as seen on” claims.
- **No implied enterprise posture**: do not imply SOC 2 / ISO / SSO / SAML / SCIM unless implemented and explicitly stated elsewhere.
- **Be explicit about scope**:
  - LeadIntel is **not** a general-purpose contact database.
  - People/buying-group surfaces are **persona-level recommendations** (heuristic, signal-based).
  - First-party intent is shown **only when observed**; otherwise we show an explicit empty state.
- **Inspectable by default**: visitors should be able to validate claims via public pages like `/how-scoring-works`, `/trust`, `/pricing`, `/compare`, and the no-signup sample.

## Migration stories: what they are (and are not)

### They are

- **Common workflow shifts** we see when teams adopt a timing-first outbound loop.
- **Pattern-based** narratives (e.g., spreadsheet → daily shortlist) that describe implementation steps and behavior change.

### They are not

- Customer case studies.
- Claims of results (lift %, pipeline numbers, reply rates) unless we have real, permissioned evidence and legal approval.
- Named companies or named individuals unless explicitly approved and already present in the repo/content system.

## Allowed story formats

- “From X to Y” framing with:
  - a starting state (current tool/workflow)
  - a target state (timing-first execution loop)
  - a small set of implementation notes (ICP → watchlist → shortlist → drafts → action)

## Content review checklist (before shipping changes)

- [ ] Each proof item matches something implemented in the codebase.
- [ ] No fabricated logos/testimonials/case studies/metrics.
- [ ] No enterprise certification/SSO claims unless explicitly true.
- [ ] First-party intent is described as conditional (“when observed”).
- [ ] People layer is described as persona-level (no named contact invention).
- [ ] Tone is calm and buyer-grade (no urgency hacks).

# Proof and migration stories (public marketing)

LeadIntel’s proof system is designed to be **inspectable** and tied to real product mechanics.

## Allowed proof sources (no fabricated social proof)
- No-signup sample digest flow
- Deterministic scoring methodology with visible reasons
- Templates library and workflow surfaces
- Webhook + export actions
- Public trust and policy pages
- Public compare pages that label uncertainty as “varies by plan/configuration”

## Implemented sections

### “Why LeadIntel feels different in practice”
Component: `components/marketing/ProofLayer.tsx`

This section is grounded in real mechanics (explainability, action packaging, team governance, inspectable trust).

### “Common switching paths”
Component: `components/marketing/MigrationStories.tsx`

These are framed as **common workflow shifts**, not case studies:
- spreadsheet + Google Alerts → daily shortlist
- broad databases → timing-first prioritization
- manual research → send-ready outreach
- one-off rep work → shared playbooks

## Guardrails
- No customer logos, testimonials, or ROI metrics are added unless real and approved.
- No enterprise certifications are claimed unless implemented and verifiable.

