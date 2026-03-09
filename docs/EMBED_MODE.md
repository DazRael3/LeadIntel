# Embed mode

LeadIntel embed mode provides **bounded, embed-safe widgets** under `/embed/*`.

## Security model

- Embed pages require a **signed, short-lived token**.
- Tokens are minted via `/api/v1/embed/tokens` (requires scope `embed.token.create`).
- Token signing uses server secret: `EMBED_SIGNING_SECRET`.
- Embeds are gated by workspace policy: `policies.platform.embedEnabled`.

## Widgets

- `/embed/account-summary` — account summary + readiness (requires `kind=account_summary`)
- `/embed/shortlist` — workspace shortlist (requires `kind=shortlist`)
- `/embed/readiness` — workspace readiness widget (requires `kind=readiness`)

These widgets are intentionally **summary-safe** and avoid exposing premium/generated bodies.

