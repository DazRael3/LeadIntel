-- 0032_fix_growth_alerts_window_column.sql
-- Fix reserved keyword column name from older deployments.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'api'
      and table_name = 'growth_alerts'
      and column_name = 'window'
  ) then
    alter table api.growth_alerts rename column "window" to window_key;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

