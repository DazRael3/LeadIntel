# Verticalization model (bounded + truthful)

LeadIntel is intentionally **workflow-focused** (signals → shortlist → explain → draft → action). This repo uses a **bounded verticalization layer** to improve relevance and navigation without claiming deep “industry cloud” specialization.

## Principles

- **No fake vertical expertise**: A vertical can be “supported” only if the product genuinely supports the workflow with real surfaces, not just copy.
- **Vertical-friendly ≠ specialized**: We can tailor examples, rails, and “best for” framing while keeping claims generic and honest.
- **The registry must drive UI**: Vertical definitions are used for template rails and “best for” framing. If it’s not in code, it’s not claimed.

## Support levels

- **supported**: The workflow fit is strong and surfaces exist in-product today.
- **vertical_friendly**: The workflow fit is credible, but we don’t claim deep domain-specific coverage.
- **not_yet_supported**: We do not position this as a fit publicly.

## Current vertical set

Defined in `lib/verticals/registry.ts`:

- **B2B SaaS outbound** (`supported`)
- **RevOps / Enablement tooling motions** (`vertical_friendly`)
- **GTM software / sales tech** (`vertical_friendly`)
- **Agency / partner-led outbound teams** (`vertical_friendly`)
- **Services / consulting outbound** (`vertical_friendly`)

## Where it’s used

- Templates discovery: curated “best fit” rails based on workflow/motion (not industry claims).
- Use-case framing: future-proofed mapping from vertical → use-cases.

## What we intentionally do NOT claim

- Universal contact database coverage
- Full CRM replacement
- Enterprise controls like SSO/SAML/SCIM unless implemented
- Compliance certifications (SOC 2, ISO) unless implemented and documented

