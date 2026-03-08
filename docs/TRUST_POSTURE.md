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

