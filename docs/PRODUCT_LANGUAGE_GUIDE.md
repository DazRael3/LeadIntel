# Product language guide (platform terminology)

This guide keeps terminology consistent across marketing, product, ops, and docs.

## Core objects

- **Account**: a tracked company/domain in a user’s watchlist/workspace.
- **Signal**: a detected event/indicator contributing to timing (with source + timestamp when available).
- **Daily shortlist**: the “what to action today” list generated from signals + fit.
- **Score (0–100)**: deterministic score with visible reasons; not a black box.
- **Pitch draft**: send-ready outreach copy generated for a specific account/context.
- **Competitive report**: a multi-section, source-backed report with citations and freshness metadata.

## Access + gating terms

- **Preview generation**: a successful generation event on the free tier that returns **locked / redacted** content.
- **Locked preview**: the UI state where the user can see a small preview but full content is gated.
- **Saved report**: a persisted competitive report entry in `api.user_reports` (`report_kind='competitive'`).
- **Shared usage**: free-tier generation usage is shared across pitches and reports.

## “Why now” language

- **Why now**: the timing rationale derived from real signals (and their recency).
- **Momentum**: rising/steady/cooling based on score movement and recent signals.
- **First-party intent**: on-site or first-party context when available; never claimed when absent.

## Roles (product polish)

- **Rep**: executes outreach; wants clarity and speed.
- **Manager**: wants consistency and team execution.
- **Operator**: wants governance, packaging, and safe handoffs.
- **Admin**: controls access/configuration; sees ops tooling.

## Prohibited phrasing (unless implemented)

Do not claim:
- SOC 2 / ISO 27001
- SSO/SAML/SCIM
- universal contact coverage / identity resolution
- CRM “sync” claims unless truly present

