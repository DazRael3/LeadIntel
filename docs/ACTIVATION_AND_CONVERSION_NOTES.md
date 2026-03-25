# Activation + Conversion Notes (Lean, Production-Safe)

This repo avoids heavy onboarding systems. Activation and conversion improvements should be **small, honest, and tied to real product value**.

## Starter first-value path (intended)
1. Land on `/dashboard` and immediately see the **primary workflow**
2. Generate a first preview output (pitch/report)
3. Understand why-now scoring at a glance (explainability)
4. Know what to do next (track accounts, revisit outputs)
5. See what upgrades unlock (without aggressive UX)

## What we improved (high-ROI, low-churn)
- **Starter dashboard hierarchy**: “generate → getting started → progress/checklist” reads clearly on smaller screens.
- **Upgrade CTAs on mobile**: primary upgrade actions are reachable and thumb-friendly in the dashboard header.
- **Support continuity**: Support and pricing are reachable from mobile nav and support contact CTAs are clearer.

## Instrumentation (minimal, high-signal)
Events are best-effort and privacy-safe (no secrets, no page content bodies).
- `support_page_viewed`
- `support_cta_clicked` (`cta`: `email` | `pricing` | `dashboard`)
- `dashboard_upgrade_clicked` (target tier)
- `dashboard_reports_clicked`
- `billing_portal_clicked`
- `feedback_opened`
- `feedback_submitted`
- `assistant_blocked` (reason + scope; indicates users are encountering entitlement/workspace friction)
- `prospect_contact_created` / `prospect_contact_selected` (Team workflow throughput)
- `outreach_draft_send_ready_set` (send-ready approval funnel)

## Lifecycle automation (email)
LeadIntel uses a small, deduped lifecycle email set (Resend + cron) to reduce confusion and improve Starter→Closer conversion without spam:
- it is **disabled by default** and requires `LIFECYCLE_EMAILS_ENABLED=1` + Resend configuration to send
- welcome + first-value nudges
- first-output reinforcement
- Starter usage reminders tied to the real **3 preview generations** cap
- calm upgrade framing (no fake urgency)
- lightweight feedback requests

## What we intentionally did NOT add
- multi-step onboarding flows
- popups, countdowns, or manipulative urgency
- third-party support/CRM tooling

