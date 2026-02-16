BEGIN;

create schema if not exists api;

grant usage on schema api to anon, authenticated;
grant select, insert, update, delete on all tables in schema api to authenticated;
grant select on all tables in schema api to anon;

alter default privileges in schema api
  grant select, insert, update, delete on tables to authenticated;

COMMIT;
