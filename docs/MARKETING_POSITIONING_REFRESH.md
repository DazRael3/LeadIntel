# Marketing positioning refresh (public site)

## Core category language (use consistently)

LeadIntel should read like:

- **Signal-based outbound platform**
- **Why-now intelligence**
- **Daily shortlist**
- **Explainable scoring**
- **Send-ready outreach**
- **Action layer for outbound teams**

Avoid:

- “portal”
- vague AI hype
- fabricated proof (logos, testimonials, ROI metrics)
- enterprise claims that are not implemented (SOC 2, SSO/SAML/SCIM)

## Homepage structure (high-level)

Homepage is designed to prove a premium workflow without fake social proof:

- Exact hero copy (see `lib/copy/leadintel.ts`)
- Proof strip (daily shortlist, explainable score, send-ready drafts, webhook/export actions)
- No-signup sample digest remains the primary evaluation path
- “Why teams switch” section (fast evaluation + clarity)
- “How LeadIntel works” workflow rail
- “Evidence, not hype” blocks (inspectable mechanics only)
- Compact trust band (tenant isolation, security headers, rate limiting, structured logging, Stripe billing)
- “Proof you can inspect today” links to sample/scoring/pricing/trust/templates/compare

## Truthfulness rules

- Do not claim integrations that aren’t implemented.
- Do not claim compliance certifications that aren’t implemented.
- Do not claim customer proof unless real approved proof exists in-repo.

