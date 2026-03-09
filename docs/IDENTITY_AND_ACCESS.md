# Identity and access

This document describes **what LeadIntel supports today** and what it does **not** claim.

## Authentication today

- LeadIntel uses **Supabase Auth** with **email/password** sessions.
- Session handling is implemented so that **secrets stay server-side**.

## Workspace access control

- Workspaces are tenant-isolated using **database Row Level Security (RLS)**.
- Workspace membership and role checks are enforced on privileged routes.

## Workspace roles

LeadIntel uses a compact role model:

- `owner`
- `admin`
- `manager`
- `rep`
- `viewer`

Roles are enforced server-side in routes and policy checks.

## Invite governance

Workspace admins can optionally configure an **invite domain allowlist**.

If enabled, invites are restricted by email domain on the server.

## What LeadIntel does not claim

- No SSO/SAML/SCIM claims unless explicitly implemented and enabled.
- No certification claims (SOC 2 / ISO 27001) unless explicitly stated.

