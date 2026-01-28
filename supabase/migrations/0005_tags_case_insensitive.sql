BEGIN;

create schema if not exists api;

-- Add a case-insensitive generated column
alter table api.tags
  add column if not exists name_ci text generated always as (lower(name)) stored;

-- UNIQUE constraint that PostgREST can target via onConflict: 'user_id,name_ci'
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tags_user_name_ci_unique'
  ) then
    alter table api.tags
      add constraint tags_user_name_ci_unique unique (user_id, name_ci);
  end if;
end $$;

create index if not exists tags_user_id_idx on api.tags(user_id);

COMMIT;
