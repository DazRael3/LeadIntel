BEGIN;

alter table api.users
  add column if not exists last_unlock_date timestamptz;

alter table api.user_settings
  add column if not exists what_you_sell text,
  add column if not exists ideal_customer text,
  add column if not exists sender_name text;

alter table api.leads
  add column if not exists battle_card jsonb,
  add column if not exists email_sequence jsonb;

alter table api.subscriptions
  add column if not exists stripe_price_id text;

COMMIT;
