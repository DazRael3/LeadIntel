# Support + Feedback Loop (Production-Safe, Low Ops Cost)

## Support posture
LeadIntel support is intentionally simple:
- **Primary channel**: email (`SUPPORT_EMAIL`)
- **Support page**: `/support` (public, canonical, mobile-friendly)
- **In-app continuity**: Support is reachable from the mobile menu

## Feedback capture (lightweight)
We capture short, privacy-safe feedback to understand:
- where users get blocked
- whether support/help pages resolve issues
- what’s confusing on Starter/locked surfaces

### Storage
Feedback is stored in Supabase under:
- **Table**: `api.feedback`

### What we store
- `user_id` (nullable; anonymous allowed)
- `route` (pathname only)
- `surface` (e.g. `support`, `dashboard`)
- `sentiment` (`up` | `down` | `note`)
- optional short `message`
- `device_class` (`mobile` | `desktop` | `unknown`)
- optional viewport size

We do **not** store passwords, API keys, or page bodies. The UI prompts users not to include secrets.

### API
- `POST /api/feedback`
  - accepts feedback from both anonymous and logged-in sessions
  - rate-limited and Origin-enforced via API guard policies
  - allowed in Review Mode (non-destructive exception)
  - optional operator notification email (Resend) when configured (deduped)

### Where it appears
- Support page: “Quick feedback”
- Starter dashboard: “Quick feedback” (non-interruptive)

## How to review feedback (no extra UI required)
Use the Supabase SQL editor (service role / owner access) and run:

```sql
select
  created_at,
  user_id,
  route,
  surface,
  sentiment,
  device_class,
  message
from api.feedback
order by created_at desc
limit 200;
```

## Cleanup / privacy
- The feedback table is lightweight and can be truncated if needed.
- Keep `ALLOWED_ORIGINS` correct so Origin enforcement doesn’t block legitimate feedback.

## Optional operator notifications
If you want new feedback to reach an operator inbox during launch, configure:
- `LIFECYCLE_ADMIN_EMAILS` (or `FEEDBACK_NOTIFICATION_EMAILS`)
- `LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED=1`
- Resend keys (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)

Notifications are deduped via `api.email_send_log` and never block the end-user feedback response.

