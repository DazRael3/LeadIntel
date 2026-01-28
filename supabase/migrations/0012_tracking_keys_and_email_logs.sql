begin;

-- user_settings: public tracker key for anonymous website tracking
alter table api.user_settings
  add column if not exists tracker_key uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api'
      and table_name = 'user_settings'
      and column_name = 'tracker_key'
  ) then
    update api.user_settings
    set tracker_key = coalesce(tracker_key, gen_random_uuid())
    where tracker_key is null;
  end if;
end $$;

create unique index if not exists user_settings_tracker_key_uq on api.user_settings(tracker_key);

-- leads: contact fields for autopilot outreach (optional)
alter table api.leads
  add column if not exists contact_email text,
  add column if not exists prospect_email text,
  add column if not exists prospect_linkedin text;

create index if not exists leads_contact_email_idx on api.leads(contact_email);

-- email_logs: add provider correlation + autopilot sequencing
alter table api.email_logs
  add column if not exists resend_message_id text,
  add column if not exists sequence_step int2,
  add column if not exists kind text default 'manual';

create index if not exists email_logs_resend_message_id_idx on api.email_logs(resend_message_id);

commit;

