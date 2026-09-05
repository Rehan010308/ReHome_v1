-- Phase 3 hardening: extra columns, RLS helper grants, identity protection.
-- Safe to run after 20260905120000_rehome_data_layer.sql.

grant usage on schema private to authenticated;

grant execute on function private.owns_organization(uuid) to authenticated;
grant execute on function private.item_owned(uuid) to authenticated;

-- Clients must not self-verify or convert a directory row.
create or replace function private.protect_organization_trust()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' then
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.is_directory := old.is_directory;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_trust on public.organizations;
create trigger organizations_protect_trust
  before update on public.organizations
  for each row execute function private.protect_organization_trust();

alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists country text;

alter table public.organizations add column if not exists website text;

alter table public.items add column if not exists quantity integer;
alter table public.items add column if not exists ai_source text;
alter table public.items add column if not exists user_corrected boolean;

update public.items set quantity = 1 where quantity is null;
update public.items set user_corrected = false where user_corrected is null;

do $$ begin
  alter table public.items alter column quantity set default 1;
  alter table public.items alter column quantity set not null;
  alter table public.items alter column user_corrected set default false;
  alter table public.items alter column user_corrected set not null;
exception when others then null;
end $$;

alter table public.requirements add column if not exists filled_quantity integer;
update public.requirements set filled_quantity = 0 where filled_quantity is null;
do $$ begin
  alter table public.requirements alter column filled_quantity set default 0;
  alter table public.requirements alter column filled_quantity set not null;
exception when others then null;
end $$;

alter table public.matches add column if not exists scored_at timestamptz;
update public.matches set scored_at = coalesce(scored_at, created_at, now());
do $$ begin
  alter table public.matches alter column scored_at set default now();
exception when others then null;
end $$;

alter table public.handoffs add column if not exists donor_confirmed_at timestamptz;
alter table public.handoffs add column if not exists recipient_confirmed_at timestamptz;
alter table public.handoffs add column if not exists feedback text;

alter table public.impact_records add column if not exists useful_life_extension_days integer;

create index if not exists matches_item_requirement_score_idx
  on public.matches (item_id, requirement_id, match_score desc);
