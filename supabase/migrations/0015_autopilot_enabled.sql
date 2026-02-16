begin;

alter table api.user_settings
  add column if not exists autopilot_enabled boolean not null default false;

comment on column api.user_settings.autopilot_enabled is
  'Controls whether this tenant is eligible for /api/autopilot/run cron sending.';

commit;

