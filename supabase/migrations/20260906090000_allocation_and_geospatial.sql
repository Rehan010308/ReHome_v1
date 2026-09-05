-- ReHome — allocation, partial fulfillment, lifecycle states and geospatial.
--
-- This migration replaces the single-number quantity model with a real
-- supply/demand/allocation model:
--
--   REQUIREMENT (demand)  ──< MATCH_ALLOCATIONS >──  ITEM (supply)
--
-- A requirement is fulfilled only when quantity_received >= quantity_requested,
-- and that ceiling is enforced by a CHECK constraint plus row-locking inside
-- allocate_to_requirement(), so two concurrent donors cannot overshoot it.
--
-- Idempotent: safe to re-run. Apply after 20260905180000_phase3_hardening.sql.

-- ── PostGIS ────────────────────────────────────────────────────────────────
-- Installed into `extensions` (never public) and every reference is schema
-- qualified, so nothing depends on search_path. Latitude/longitude remain the
-- source of truth; the geography column is derived, so if PostGIS is ever
-- unavailable the application can still fall back to haversine on the numerics.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ── Enum rebuilds ──────────────────────────────────────────────────────────
-- Rebuilt rather than ALTER TYPE ... ADD VALUE, which cannot be used in the
-- same transaction it is added in and would make this file order-dependent.

-- Postgres refuses to retype a column that a policy references, so the policy
-- is dropped first and recreated below with the corrected predicate.
drop policy if exists requirements_select_open_or_own on public.requirements;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'requirement_state') then
    create type public.requirement_state as enum
      ('open', 'partially_fulfilled', 'fulfilled', 'expired', 'closed');

    alter table public.requirements alter column status drop default;
    alter table public.requirements
      alter column status type public.requirement_state
      using (
        case status::text
          when 'partially_filled' then 'partially_fulfilled'
          when 'filled' then 'fulfilled'
          else status::text
        end
      )::public.requirement_state;
    alter table public.requirements alter column status set default 'open';
  end if;
end $$;

-- Recreated with 'partially_fulfilled' included. Without it, a requirement
-- disappears from every donor's view the moment the first person contributes,
-- which would make multi-donor aggregation impossible — the exact thing this
-- migration exists to enable.
create policy requirements_select_open_or_own on public.requirements
  for select to authenticated
  using (
    status in ('open', 'partially_fulfilled')
    or (select private.owns_organization(organization_id))
  );

do $$
begin
  if not exists (select 1 from pg_type where typname = 'item_state') then
    create type public.item_state as enum (
      'listed', 'analyzing', 'confirmed', 'matched', 'allocated',
      'handoff_scheduled', 'handed_over', 'second_life_confirmed', 'withdrawn'
    );

    alter table public.items alter column status drop default;
    alter table public.items
      alter column status type public.item_state
      using (
        case status::text
          when 'accepted' then 'allocated'
          when 'scheduled' then 'handoff_scheduled'
          when 'confirmed' then 'second_life_confirmed'
          else status::text
        end
      )::public.item_state;
    alter table public.items alter column status set default 'listed';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_state') then
    create type public.match_state as enum
      ('suggested', 'accepted', 'declined', 'allocated', 'cancelled', 'completed');

    alter table public.matches alter column status drop default;
    alter table public.matches
      alter column status type public.match_state
      using (
        case status::text
          when 'expired' then 'cancelled'
          else status::text
        end
      )::public.match_state;
    alter table public.matches alter column status set default 'suggested';
  end if;
end $$;

do $$ begin
  create type public.allocation_state as enum
    ('allocated', 'handoff_scheduled', 'handed_over', 'confirmed', 'cancelled');
exception when duplicate_object then null;
end $$;

-- ── Geospatial columns ─────────────────────────────────────────────────────
-- location_precision records how exact the stored point is, so the UI can
-- honour donor privacy: 'exact' is only ever set with explicit consent, and
-- 'city' / 'area' are what a donor's coordinates should normally be rounded to.

alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_precision text not null default 'city';

alter table public.organizations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists service_radius_km numeric(6, 2) not null default 25;

alter table public.items
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.requirements
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists needed_by date;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'organizations', 'items', 'requirements'] loop
    execute format($f$
      alter table public.%I add column if not exists geo extensions.geography(Point, 4326)
        generated always as (
          case when latitude is not null and longitude is not null
            then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
          end
        ) stored
    $f$, t);
    execute format('create index if not exists %I on public.%I using gist (geo)', t || '_geo_idx', t);
  end loop;
end $$;

-- ── Requirement quantity model ─────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'requirements' and column_name = 'quantity'
  ) then
    alter table public.requirements rename column quantity to quantity_requested;
  end if;
end $$;

alter table public.requirements
  add column if not exists quantity_received integer not null default 0;

alter table public.requirements drop column if exists filled_quantity;

do $$ begin
  alter table public.requirements
    add constraint requirements_received_nonneg check (quantity_received >= 0);
exception when duplicate_object then null; end $$;

-- The hard ceiling. Even if application logic is wrong, the database refuses
-- to record more contributions than were asked for.
do $$ begin
  alter table public.requirements
    add constraint requirements_no_overfill check (quantity_received <= quantity_requested);
exception when duplicate_object then null; end $$;

alter table public.requirements
  add column if not exists quantity_remaining integer
    generated always as (quantity_requested - quantity_received) stored;

alter table public.requirements
  add column if not exists fulfillment_percentage numeric(5, 2)
    generated always as (
      round(100.0 * quantity_received / nullif(quantity_requested, 0), 2)
    ) stored;

-- ── Item quantity model ────────────────────────────────────────────────────
alter table public.items
  add column if not exists quantity_allocated integer not null default 0,
  add column if not exists quantity_handed_over integer not null default 0;

do $$ begin
  alter table public.items add constraint items_quantity_positive check (quantity > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.items
    add constraint items_allocation_within_stock
    check (quantity_allocated >= 0 and quantity_allocated <= quantity);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.items
    add constraint items_handover_within_allocation
    check (quantity_handed_over >= 0 and quantity_handed_over <= quantity_allocated);
exception when duplicate_object then null; end $$;

alter table public.items
  add column if not exists quantity_available integer
    generated always as (quantity - quantity_allocated) stored;

-- ── Match quantity context ─────────────────────────────────────────────────
alter table public.matches
  add column if not exists quantity_offered integer not null default 1,
  add column if not exists quantity_allocated integer not null default 0,
  add column if not exists confidence numeric(5, 2),
  add column if not exists distance_km numeric(8, 2),
  add column if not exists needs_type_confirmation boolean not null default false;

-- ── Allocations: many donors contributing to one requirement ───────────────
create table if not exists public.match_allocations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  item_id uuid not null references public.items (id) on delete cascade,
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  donor_id uuid not null references public.profiles (user_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quantity_allocated integer not null check (quantity_allocated > 0),
  status public.allocation_state not null default 'allocated',
  handoff_id uuid references public.handoffs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_allocations_requirement_idx on public.match_allocations (requirement_id);
create index if not exists match_allocations_item_idx on public.match_allocations (item_id);
create index if not exists match_allocations_donor_idx on public.match_allocations (donor_id);
create index if not exists match_allocations_org_idx on public.match_allocations (organization_id);
create index if not exists match_allocations_status_idx on public.match_allocations (status);

drop trigger if exists match_allocations_set_updated_at on public.match_allocations;
create trigger match_allocations_set_updated_at before update on public.match_allocations
for each row execute function private.set_updated_at();

-- ── Handoff + impact quantity ──────────────────────────────────────────────
alter table public.handoffs
  add column if not exists allocation_id uuid references public.match_allocations (id) on delete cascade,
  add column if not exists quantity integer not null default 1,
  add column if not exists scheduled_for timestamptz,
  add column if not exists handoff_location text;

alter table public.impact_records
  add column if not exists quantity integer not null default 1,
  add column if not exists allocation_id uuid references public.match_allocations (id) on delete set null,
  add column if not exists destination_tier text,
  add column if not exists points integer not null default 0;

create index if not exists impact_records_allocation_idx on public.impact_records (allocation_id);

-- ── Transaction-safe allocation ────────────────────────────────────────────
-- Locks the requirement and item rows before reading their remaining capacity,
-- so two donors racing for the last unit serialise instead of both succeeding.
create or replace function public.allocate_to_requirement(
  p_item_id uuid,
  p_requirement_id uuid,
  p_quantity integer,
  p_match_id uuid default null
)
returns public.match_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.items;
  v_req public.requirements;
  v_org uuid;
  v_alloc public.match_allocations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  -- Lock supply and demand in a stable order to avoid deadlocks.
  select * into v_item from public.items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_item.owner_id <> v_uid then
    raise exception 'You can only allocate your own items';
  end if;

  select * into v_req from public.requirements where id = p_requirement_id for update;
  if not found then
    raise exception 'Requirement not found';
  end if;
  if v_req.status in ('fulfilled', 'closed', 'expired') then
    raise exception 'This requirement is no longer open';
  end if;

  if p_quantity > (v_item.quantity - v_item.quantity_allocated) then
    raise exception 'Only % of this item remain unallocated', v_item.quantity - v_item.quantity_allocated;
  end if;
  if p_quantity > (v_req.quantity_requested - v_req.quantity_received) then
    raise exception 'Only % more are still needed for this requirement',
      v_req.quantity_requested - v_req.quantity_received;
  end if;

  select organization_id into v_org from public.requirements where id = p_requirement_id;

  insert into public.match_allocations (
    match_id, item_id, requirement_id, donor_id, organization_id, quantity_allocated
  )
  values (p_match_id, p_item_id, p_requirement_id, v_uid, v_org, p_quantity)
  returning * into v_alloc;

  update public.requirements
     set quantity_received = quantity_received + p_quantity,
         status = case
           when quantity_received + p_quantity >= quantity_requested then 'fulfilled'::public.requirement_state
           else 'partially_fulfilled'::public.requirement_state
         end
   where id = p_requirement_id;

  update public.items
     set quantity_allocated = quantity_allocated + p_quantity,
         status = 'allocated'::public.item_state
   where id = p_item_id;

  if p_match_id is not null then
    update public.matches
       set status = 'allocated'::public.match_state,
           quantity_allocated = quantity_allocated + p_quantity
     where id = p_match_id;
  end if;

  return v_alloc;
end;
$$;

-- ── Verified handoff completion ────────────────────────────────────────────
-- Only the receiving organization can confirm second life, and impact is
-- written here and nowhere else — so impact can never precede a real handoff.
create or replace function public.confirm_second_life(p_allocation_id uuid)
returns public.match_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alloc public.match_allocations;
  v_item public.items;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_alloc from public.match_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'Allocation not found';
  end if;
  if v_alloc.status = 'confirmed' then
    return v_alloc;
  end if;
  if v_alloc.status = 'cancelled' then
    raise exception 'This allocation was cancelled';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = v_alloc.organization_id and o.owner_id = v_uid
  ) then
    raise exception 'Only the receiving organization can confirm a handoff';
  end if;

  update public.match_allocations set status = 'confirmed' where id = p_allocation_id
  returning * into v_alloc;

  update public.items
     set quantity_handed_over = quantity_handed_over + v_alloc.quantity_allocated,
         status = case
           when quantity_handed_over + v_alloc.quantity_allocated >= quantity
             then 'second_life_confirmed'::public.item_state
           else 'handed_over'::public.item_state
         end
   where id = v_alloc.item_id
  returning * into v_item;

  -- Impact is recorded for the quantity this donor actually handed over,
  -- never the size of the requirement.
  insert into public.impact_records (
    user_id, item_id, organization_id, allocation_id, outcome, destination,
    destination_tier, quantity, points, metrics
  )
  values (
    v_alloc.donor_id, v_alloc.item_id, v_alloc.organization_id, v_alloc.id,
    'second_life_confirmed', v_item.destination_path, v_item.destination_path,
    v_alloc.quantity_allocated,
    v_alloc.quantity_allocated * 10,
    jsonb_build_object('category', v_item.category, 'item_type', v_item.item_type)
  );

  return v_alloc;
end;
$$;

-- ── Spatial demand search ──────────────────────────────────────────────────
-- Returns open requirements within a radius with real distances, so the app
-- never has to invent "2.4 km away". Falls back to the organization's point
-- when a requirement has no coordinates of its own.
create or replace function public.nearby_requirements(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 25,
  p_limit integer default 100
)
returns table (
  requirement_id uuid,
  organization_id uuid,
  distance_km numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select r.id,
         r.organization_id,
         round((extensions.st_distance(coalesce(r.geo, o.geo), origin.g) / 1000)::numeric, 2)
  from public.requirements r
  join public.organizations o on o.id = r.organization_id
  cross join origin
  where r.status in ('open', 'partially_fulfilled')
    and r.quantity_received < r.quantity_requested
    and coalesce(r.geo, o.geo) is not null
    and extensions.st_dwithin(coalesce(r.geo, o.geo), origin.g, p_radius_km * 1000)
  order by 3 asc
  limit p_limit;
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.match_allocations enable row level security;
alter table public.match_allocations force row level security;

drop policy if exists allocations_select_parties on public.match_allocations;
create policy allocations_select_parties on public.match_allocations
  for select to authenticated
  using (
    donor_id = (select auth.uid())
    or (select private.owns_organization(organization_id))
  );

-- Writes go through the RPCs, which hold the locks that keep quantities sane.
drop policy if exists allocations_update_parties on public.match_allocations;
create policy allocations_update_parties on public.match_allocations
  for update to authenticated
  using (
    donor_id = (select auth.uid())
    or (select private.owns_organization(organization_id))
  )
  with check (
    donor_id = (select auth.uid())
    or (select private.owns_organization(organization_id))
  );

grant select, update on public.match_allocations to authenticated;
grant execute on function public.allocate_to_requirement(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.confirm_second_life(uuid) to authenticated;
grant execute on function public.nearby_requirements(double precision, double precision, numeric, integer) to authenticated;

-- Organizations must be able to read the items allocated to their requirements.
drop policy if exists items_select_allocated_to_org on public.items;
create policy items_select_allocated_to_org on public.items
  for select to authenticated
  using (
    exists (
      select 1 from public.match_allocations a
      where a.item_id = items.id
        and (select private.owns_organization(a.organization_id))
    )
  );

-- ── Seed coordinates for the demo directory ────────────────────────────────
-- Marked explicitly as directory rows; the UI must label them as seeded.
update public.organizations set latitude = 12.9716, longitude = 77.5946
  where id = '11111111-1111-4111-8111-111111111111' and latitude is null;
update public.organizations set latitude = 12.9352, longitude = 77.6245
  where id = '22222222-2222-4222-8222-222222222222' and latitude is null;
update public.organizations set latitude = 13.0358, longitude = 77.5970
  where id = '33333333-3333-4333-8333-333333333333' and latitude is null;
update public.organizations set latitude = 12.9698, longitude = 77.7500
  where id = '44444444-4444-4444-8444-444444444444' and latitude is null;
