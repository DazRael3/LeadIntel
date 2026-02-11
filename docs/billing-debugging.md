## Billing / plan debugging (Supabase)

### Canonical sources of truth

- **Subscription row**: `api.subscriptions` (preferred)
- **Fallback marker**: `api.users.subscription_tier` (internal marker: `'free' | 'pro'`)

The application maps these DB markers to product tiers:

- `subscription_tier = 'free'` (or no active subscription) → **Starter**
- `subscription_tier = 'pro'` (or active subscription) → **Closer**

### SQL: inspect a user’s plan state

Replace `<USER_ID>` with the Supabase auth user id (UUID).

```sql
-- Look at subscriptions for a user (canonical)
select
  id,
  user_id,
  status,
  stripe_subscription_id,
  stripe_customer_id,
  stripe_price_id,
  price_id,
  trial_end,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at
from api.subscriptions
where user_id = '<USER_ID>'
order by created_at desc;
```

```sql
-- Check the fallback tier marker
select id, subscription_tier
from api.users
where id = '<USER_ID>';
```

### Common pitfalls

- If you see `ERROR: 42703: column "...“ does not exist`, your Supabase project likely hasn’t applied the latest migrations.
- If you see `permission denied for schema api`, ensure schema USAGE + table grants exist for the role (and that `api` is exposed in Supabase “Exposed schemas” settings).

