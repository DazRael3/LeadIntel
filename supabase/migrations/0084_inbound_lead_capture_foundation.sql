begin;

set local search_path = public, extensions, api;

alter table api.lead_captures
  add column if not exists source_page text,
  add column if not exists form_type text,
  add column if not exists name text,
  add column if not exists consent_marketing boolean not null default false,
  add column if not exists consent_timestamp timestamptz,
  add column if not exists status text not null default 'new';

update api.lead_captures
set source_page = route
where source_page is null;

update api.lead_captures
set form_type = intent
where form_type is null;

alter table api.lead_captures
  alter column source_page set default '/',
  alter column source_page set not null,
  alter column form_type set default 'demo',
  alter column form_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_captures_status_check'
      and conrelid = 'api.lead_captures'::regclass
  ) then
    alter table api.lead_captures
      add constraint lead_captures_status_check
      check (status in ('new', 'contacted', 'qualified', 'disqualified', 'archived'));
  end if;
end $$;

create index if not exists lead_captures_form_type_idx on api.lead_captures (form_type);
create index if not exists lead_captures_status_idx on api.lead_captures (status);

notify pgrst, 'reload schema';
commit;
