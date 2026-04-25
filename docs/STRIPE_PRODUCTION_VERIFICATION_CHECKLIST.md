# Stripe Production Verification Checklist

This checklist verifies the end-to-end paid conversion flow for LeadIntel:

1. Checkout session creation
2. Stripe webhook delivery
3. Supabase subscription tier update
4. UI entitlement changes (limits/export access)

---

## 0) Preconditions

- Production env vars are configured:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - App price env vars (`STRIPE_PRICE_ID_*`)
- The app is running locally or in a preview environment with Stripe test mode enabled.
- Supabase migrations are applied (including subscription tables/columns).

---

## 1) Start webhook forwarding (Stripe CLI)

```bash
stripe login
stripe listen --forward-to "http://localhost:3000/api/stripe/webhook"
```

Copy the displayed webhook signing secret (`whsec_...`) and set it locally:

```bash
export STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

Restart the app after setting env if required.

---

## 2) Trigger webhook replay smoke test

With `stripe listen` running in one terminal:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

Expected:
- `/api/stripe/webhook` returns `2xx`
- No signature validation errors
- Event processing is idempotent (replaying same event does not duplicate rows)

Optional replay of a known event:

```bash
stripe events list --limit 5
stripe events resend <event_id> --webhook-endpoint=<webhook_endpoint_id>
```

---

## 3) Run a real checkout flow (test card)

1. Log in as a test user in the app.
2. Go to `/pricing`.
3. Choose a paid plan and start checkout.
4. Complete payment using Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
   - ZIP: any valid value

Expected:
- Checkout opens with correct plan/price.
- Success page loads.
- App returns to dashboard with paid entitlements enabled.

---

## 4) SQL verification (Supabase)

Run checks in Supabase SQL editor after checkout:

```sql
-- User tier should be upgraded from free to paid tier.
select id, email, subscription_tier, updated_at
from api.users
where email = '<test-user-email>';

-- Subscription record should be present and active/trialing.
select user_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_end, updated_at
from api.subscriptions
where user_id = '<test-user-id>'
order by updated_at desc
limit 5;
```

Expected:
- `api.users.subscription_tier` reflects paid plan.
- `api.subscriptions` row exists with valid Stripe IDs and active/trialing status.

---

## 5) UI entitlement verification

After successful payment:

1. Dashboard should show upgraded plan state.
2. Lead generation limits should increase (no free-tier cap behavior).
3. AI pitch limits should increase.
4. Campaign save flows should remain available.
5. Campaign export should succeed:
   - Go to `/campaign`
   - Export campaign
   - Confirm CSV download/signed URL works
6. Export settings should work:
   - Go to `/settings/exports`
   - Create and download exports

Expected:
- No paid feature returns `403` for the upgraded user.
- No regression in existing free-user gating for non-paid accounts.

---

## 6) Negative checks

1. Downgrade/cancel in Stripe test mode.
2. Replay `customer.subscription.updated` / `customer.subscription.deleted`.
3. Re-check SQL + UI.

Expected:
- Tier returns to free-equivalent behavior.
- Paid features are blocked server-side (`403`) for downgraded user.

---

## 7) Evidence to capture for release signoff

- Screenshot of successful Stripe checkout session
- Screenshot/log of webhook delivery success
- SQL result snippets for `api.users` + `api.subscriptions`
- Screenshot of upgraded UI entitlements
- Screenshot of successful export download
