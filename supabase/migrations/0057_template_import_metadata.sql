begin;

set local search_path = public, extensions, api;

alter table api.templates
  add column if not exists import_source text not null default 'local',
  add column if not exists origin_workspace_id uuid null references api.workspaces(id) on delete set null,
  add column if not exists origin_template_id uuid null references api.templates(id) on delete set null,
  add column if not exists imported_at timestamptz null,
  add column if not exists imported_by uuid null references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'api.templates'::regclass
      and conname = 'templates_import_source_check'
  ) then
    alter table api.templates
      add constraint templates_import_source_check check (import_source in ('local','imported'));
  end if;
exception when undefined_table then
  -- ignore
end $$;

create index if not exists templates_origin_template_idx on api.templates (origin_template_id);
create index if not exists templates_origin_workspace_idx on api.templates (origin_workspace_id);

notify pgrst, 'reload schema';
commit;

