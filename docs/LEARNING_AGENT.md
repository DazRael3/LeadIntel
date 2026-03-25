# Learning agent (internal-only)

LeadIntel includes a small, production-safe “learning agent” intended for **operators/founders**, not end users.

It is **recommendation-first**:
- it **suggests** what to fix next
- it does **not** auto-edit routes, copy, settings, or configuration
- it does **not** auto-send external outreach

## Where it lives

- **Surface**: `/admin/ops?token=$ADMIN_TOKEN` → “Learning agent (internal)” card

## What it uses (privacy-safe signals)

The learning agent intentionally uses **metadata-only** signals:

- `api.feedback` (route, surface, sentiment, short message)
- `api.product_analytics` (internal event names + small props; no bodies)
- `api.email_send_log` (status, template, qa issue codes in meta)
- Prospect watch queue state:
  - `api.prospect_watch_prospects` (status)
  - `api.prospect_watch_outreach_drafts` (send_ready)
- Email template QA results (local registry checks; no user data)

## What it outputs

Actionable recommendations like:
- email template QA warnings/errors to fix before enabling lifecycle sends broadly
- assistant entitlement blocks (plan/workspace/auth) suggesting clearer gating or alternate paths
- queue throughput bottlenecks (many “new” prospects, send-ready backlog)
- email send failures suggesting Resend deliverability/config review

Each recommendation includes:
- a short title/summary
- “why this matters”
- links to the relevant ops/tools surfaces

## Safety model

- No autonomous actions
- No copying/storing of private message bodies
- No cross-workspace access beyond existing admin-service-role ops surfaces

