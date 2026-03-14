# Audit tier access (Closer / Closer+ / Team)

This repo supports **temporary, revocable tier elevation** for auditors (including AI auditors that log in as a normal user).

Use **both** controls together:
- **Delegated access** (workspace membership): `/settings/partner-access`
- **Audit tier access** (plan tier): `/settings/platform`

## Why two controls exist
- Workspace access (membership) and plan tier (Starter/Closer/Closer+/Team) are separate concepts.
- Delegated access grants workspace-scoped access without sharing credentials.
- Audit tier access temporarily upgrades the auditor’s user tier so Team-only and paid-only surfaces can be audited.

## How it works (high-level)
- You grant an auditor email a tier in **Platform → Audit tier access**.
- The system stores a grant record and temporarily updates the auditor’s `api.users.subscription_tier` to match the requested tier.
- Revoke restores the prior tier **when safe** (it will not override an active/trialing Stripe subscription).

## Governance / restrictions
- Only **workspace owner/admin** can grant/revoke audit tier access.
- The auditor must **already have an account** (must sign up first).
- Audit tier access is intended for temporary evaluation windows. Revoke when finished.

