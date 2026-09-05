-- ReHome Phase 3 data layer
-- Apply in the Supabase SQL editor (or via CLI) on the project used by the Vite app.
-- Idempotent enough to re-run on a fresh project; do not re-run blindly on a populated DB.

create schema if not exists private;

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type public.account_type as enum ('individual', 'organization');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.item_status as enum (
    'listed', 'matched', 'accepted', 'scheduled', 'handed_over', 'confirmed', 'withdrawn'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.requirement_status as enum ('open', 'partially_filled', 'filled', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.match_status as enum (
    'suggested', 'accepted', 'declined', 'expired', 'completed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.handoff_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.urgency_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_type public.account_type,
  display_name text not null default 'Member',
  email text,
  phone text,
  location text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.profiles (user_id) on delete cascade,
  name text not null,
  org_type text not null default 'community',
  description text,
  location text,
  contact_email text,
  contact_phone text,
  verification_status public.verification_status not null default 'unverified',
  is_directory boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_owner_or_directory check (
    (is_directory = true and owner_id is null)
    or (is_directory = false and owner_id is not null)
  )
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (user_id) on delete cascade,
  category text not null,
  subcategory text not null default '',
  item_type text not null,
  condition text not null default 'Unknown',
  reusability text not null default 'Unknown',
  reusability_score numeric(5, 2) not null default 50
    check (reusability_score >= 0 and reusability_score <= 100),
  potential_use text,
  destination_path text,
  image_path text,
  location text,
  status public.item_status not null default 'listed',
  confidence numeric(5, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category text not null,
  subcategory text not null default '',
  item_type text not null,
  quantity integer not null default 1 check (quantity > 0),
  required_condition text not null default 'Any',
  location text,
  urgency public.urgency_level not null default 'medium',
  status public.requirement_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  match_score numeric(5, 2) not null check (match_score >= 0 and match_score <= 100),
  matching_factors jsonb not null default '[]'::jsonb,
  status public.match_status not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, requirement_id)
);

create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  verification_status public.verification_status not null default 'unverified',
  status public.handoff_status not null default 'scheduled',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.impact_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  outcome text not null,
  destination text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes (FKs + RLS/filter columns) ─────────────────────────────────────
create index if not exists items_owner_id_idx on public.items (owner_id);
create index if not exists items_status_idx on public.items (status);
create index if not exists items_category_idx on public.items (category);
create index if not exists requirements_organization_id_idx on public.requirements (organization_id);
create index if not exists requirements_status_idx on public.requirements (status);
create index if not exists requirements_category_idx on public.requirements (category);
create index if not exists matches_item_id_idx on public.matches (item_id);
create index if not exists matches_requirement_id_idx on public.matches (requirement_id);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists handoffs_item_id_idx on public.handoffs (item_id);
create index if not exists handoffs_organization_id_idx on public.handoffs (organization_id);
create index if not exists impact_records_user_id_idx on public.impact_records (user_id);
create index if not exists organizations_owner_id_idx on public.organizations (owner_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
for each row execute function private.set_updated_at();

drop trigger if exists requirements_set_updated_at on public.requirements;
create trigger requirements_set_updated_at before update on public.requirements
for each row execute function private.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at before update on public.matches
for each row execute function private.set_updated_at();

drop trigger if exists handoffs_set_updated_at on public.handoffs;
create trigger handoffs_set_updated_at before update on public.handoffs
for each row execute function private.set_updated_at();

-- ── Auth signup → profile (+ org) ──────────────────────────────────────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_name text;
begin
  v_type := new.raw_user_meta_data->>'account_type';
  if v_type not in ('individual', 'organization') then
    v_type := null;
  end if;

  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Member');

  insert into public.profiles (user_id, account_type, display_name, email)
  values (
    new.id,
    v_type::public.account_type,
    v_name,
    new.email
  )
  on conflict (user_id) do nothing;

  if v_type = 'organization' then
    insert into public.organizations (owner_id, name, org_type, contact_email, verification_status)
    values (new.id, v_name, 'community', new.email, 'unverified')
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Allow account_type to be set once (onboarding), never rewritten.
create or replace function private.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  if old.account_type is not null and new.account_type is distinct from old.account_type then
    raise exception 'account_type cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
  before update on public.profiles
  for each row execute function private.protect_profile_identity();

-- ── RLS helpers ────────────────────────────────────────────────────────────
create or replace function private.owns_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = org_id
      and o.owner_id is not null
      and o.owner_id = (select auth.uid())
  );
$$;

create or replace function private.item_owned(item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.items i
    where i.id = item and i.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_organization(uuid) from public, anon, authenticated;
revoke all on function private.item_owned(uuid) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.items enable row level security;
alter table public.requirements enable row level security;
alter table public.matches enable row level security;
alter table public.handoffs enable row level security;
alter table public.impact_records enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.items force row level security;
alter table public.requirements force row level security;
alter table public.matches force row level security;
alter table public.handoffs force row level security;
alter table public.impact_records force row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- organizations: own row, plus directory/verified demand network
drop policy if exists organizations_select_visible on public.organizations;
create policy organizations_select_visible on public.organizations
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or is_directory = true
    or verification_status = 'verified'
  );

drop policy if exists organizations_insert_own on public.organizations;
create policy organizations_insert_own on public.organizations
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and is_directory = false
  );

drop policy if exists organizations_update_own on public.organizations;
create policy organizations_update_own on public.organizations
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and is_directory = false);

-- items
drop policy if exists items_select_own on public.items;
create policy items_select_own on public.items
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists items_select_matched_to_org on public.items;
create policy items_select_matched_to_org on public.items
  for select to authenticated
  using (
    exists (
      select 1
      from public.matches m
      join public.requirements r on r.id = m.requirement_id
      where m.item_id = items.id
        and (select private.owns_organization(r.organization_id))
    )
  );

drop policy if exists items_insert_own on public.items;
create policy items_insert_own on public.items
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists items_update_own on public.items;
create policy items_update_own on public.items
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists items_delete_own on public.items;
create policy items_delete_own on public.items
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- requirements
drop policy if exists requirements_select_open_or_own on public.requirements;
create policy requirements_select_open_or_own on public.requirements
  for select to authenticated
  using (
    status = 'open'
    or (select private.owns_organization(organization_id))
  );

drop policy if exists requirements_insert_own_org on public.requirements;
create policy requirements_insert_own_org on public.requirements
  for insert to authenticated
  with check ((select private.owns_organization(organization_id)));

drop policy if exists requirements_update_own_org on public.requirements;
create policy requirements_update_own_org on public.requirements
  for update to authenticated
  using ((select private.owns_organization(organization_id)))
  with check ((select private.owns_organization(organization_id)));

drop policy if exists requirements_delete_own_org on public.requirements;
create policy requirements_delete_own_org on public.requirements
  for delete to authenticated
  using ((select private.owns_organization(organization_id)));

-- matches
drop policy if exists matches_select_parties on public.matches;
create policy matches_select_parties on public.matches
  for select to authenticated
  using (
    (select private.item_owned(item_id))
    or exists (
      select 1 from public.requirements r
      where r.id = matches.requirement_id
        and (select private.owns_organization(r.organization_id))
    )
  );

drop policy if exists matches_insert_item_owner on public.matches;
create policy matches_insert_item_owner on public.matches
  for insert to authenticated
  with check ((select private.item_owned(item_id)));

drop policy if exists matches_update_parties on public.matches;
create policy matches_update_parties on public.matches
  for update to authenticated
  using (
    (select private.item_owned(item_id))
    or exists (
      select 1 from public.requirements r
      where r.id = matches.requirement_id
        and (select private.owns_organization(r.organization_id))
    )
  )
  with check (
    (select private.item_owned(item_id))
    or exists (
      select 1 from public.requirements r
      where r.id = matches.requirement_id
        and (select private.owns_organization(r.organization_id))
    )
  );

-- handoffs
drop policy if exists handoffs_select_parties on public.handoffs;
create policy handoffs_select_parties on public.handoffs
  for select to authenticated
  using (
    (select private.item_owned(item_id))
    or (select private.owns_organization(organization_id))
  );

drop policy if exists handoffs_insert_item_owner on public.handoffs;
create policy handoffs_insert_item_owner on public.handoffs
  for insert to authenticated
  with check ((select private.item_owned(item_id)));

drop policy if exists handoffs_update_parties on public.handoffs;
create policy handoffs_update_parties on public.handoffs
  for update to authenticated
  using (
    (select private.item_owned(item_id))
    or (select private.owns_organization(organization_id))
  )
  with check (
    (select private.item_owned(item_id))
    or (select private.owns_organization(organization_id))
  );

-- impact: owner only until later phases confirm outcomes
drop policy if exists impact_select_own on public.impact_records;
create policy impact_select_own on public.impact_records
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists impact_insert_own on public.impact_records;
create policy impact_insert_own on public.impact_records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ── Grants (Data API) ──────────────────────────────────────────────────────
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.requirements to authenticated;
grant select, insert, update on public.matches to authenticated;
grant select, insert, update on public.handoffs to authenticated;
grant select, insert on public.impact_records to authenticated;

-- ── Storage ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', false)
on conflict (id) do nothing;

drop policy if exists item_images_insert_own on storage.objects;
create policy item_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists item_images_select_authenticated on storage.objects;
create policy item_images_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'item-images');

drop policy if exists item_images_update_own on storage.objects;
create policy item_images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists item_images_delete_own on storage.objects;
create policy item_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── Directory charities (example demand network) ───────────────────────────
insert into public.organizations (
  id, owner_id, name, org_type, description, location, contact_email,
  verification_status, is_directory
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    null,
    'Bright Futures School',
    'government_school',
    'Government school seeking textbooks, bags and basic stationery for classrooms.',
    'Bengaluru · 2 km',
    'needs@brightfutures.example',
    'verified',
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    null,
    'Sunrise Children''s Home',
    'shelter',
    'Residential child-care home. Clothing, bedding and learning materials.',
    'Bengaluru · 4 km',
    'intake@sunrisehome.example',
    'verified',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    null,
    'GreenCycle Hub',
    'recycler',
    'Certified e-waste and materials recovery for items that cannot be reused.',
    'Bengaluru · 6 km',
    'intake@greencycle.example',
    'verified',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    null,
    'City Food Bank',
    'community_kitchen',
    'Community kitchen accepting utensils, shelving and sealed dry-goods containers.',
    'Bengaluru · 8 km',
    'ops@cityfoodbank.example',
    'verified',
    true
  )
on conflict (id) do nothing;

insert into public.requirements (
  organization_id, category, subcategory, item_type, quantity, required_condition, location, urgency, status
)
select v.organization_id, v.category, v.subcategory, v.item_type, v.quantity, v.required_condition, v.location, v.urgency, v.status
from (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'Education', 'Books', 'Mathematics Textbook', 30, 'Good', 'Bengaluru · 2 km', 'high'::public.urgency_level, 'open'::public.requirement_status),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'Education', 'Bags', 'Backpack', 20, 'Any', 'Bengaluru · 2 km', 'medium'::public.urgency_level, 'open'::public.requirement_status),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'Clothing', 'Apparel', 'Clothing', 50, 'Wearable', 'Bengaluru · 4 km', 'high'::public.urgency_level, 'open'::public.requirement_status),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'Home', 'Bedding', 'Blanket', 15, 'Clean', 'Bengaluru · 4 km', 'critical'::public.urgency_level, 'open'::public.requirement_status),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'Electronics', 'E-waste', 'Broken Electronics', 100, 'Any', 'Bengaluru · 6 km', 'medium'::public.urgency_level, 'open'::public.requirement_status),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'Electronics', 'Computers', 'Laptop', 8, 'Repairable', 'Bengaluru · 6 km', 'medium'::public.urgency_level, 'open'::public.requirement_status),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'Home', 'Kitchen', 'Utensils', 40, 'Usable', 'Bengaluru · 8 km', 'medium'::public.urgency_level, 'open'::public.requirement_status)
) as v(organization_id, category, subcategory, item_type, quantity, required_condition, location, urgency, status)
where not exists (
  select 1
  from public.requirements r
  where r.organization_id = v.organization_id
    and r.item_type = v.item_type
);
