-- ReHome — demo destination network, impact-point rules, and trust hardening.
--
-- Idempotent. Apply after 20260906120000_handoff_lifecycle.sql.
--
-- Three separate concerns, deliberately shipped together because they all
-- touch how a destination earns trust and how a contribution earns credit:
--
--   1. Partially fulfilled requirements become visible to every donor again.
--   2. Clients can no longer assert their own verification status.
--   3. Impact points reflect what an item actually did, not a flat rate.
--
-- Plus a seeded demo network so the organization side can be exercised end to
-- end without inventing data in the interface.

-- ── 1. Many donors, one requirement ────────────────────────────────────────
--
-- The select policy only exposed requirements with status = 'open'. The moment
-- one donor contributed a single unit the row flipped to 'partially_fulfilled'
-- and vanished for everyone else — so a school needing 30 textbooks became
-- unreachable after the first book. Contributions from many people are supposed
-- to accumulate against the same requirement, and this is what makes that
-- possible.

drop policy if exists requirements_select_open_or_own on public.requirements;
create policy requirements_select_open_or_own on public.requirements
  for select to authenticated
  using (
    status in ('open', 'partially_fulfilled')
    or (select private.owns_organization(organization_id))
  );

-- ── 2. Verification is granted, never claimed ──────────────────────────────
--
-- protect_organization_trust() already froze verification_status on UPDATE, but
-- INSERT was unguarded: the insert policy only checked owner_id and
-- is_directory, so a client could create an organization that claimed to be
-- verified. Verification now always starts at 'unverified' for anything created
-- by a signed-in client.
--
-- Both triggers exempt server-side work (auth.uid() is null), because the point
-- is to stop clients asserting trust — not to stop the database owner
-- administering it from a migration or a back office.

create or replace function private.protect_organization_trust()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'update' then
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.is_directory := old.is_directory;
    new.verification_status := old.verification_status;
  elsif tg_op = 'insert' then
    new.verification_status := 'unverified';
    new.is_directory := false;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_protect_trust on public.organizations;
create trigger organizations_protect_trust
  before insert or update on public.organizations
  for each row execute function private.protect_organization_trust();

-- ── 3. Impact points describe the outcome ──────────────────────────────────
--
-- A flat ten points per unit said nothing about what the item did next. The
-- rates below are the ones the interface explains, and the breakdown is written
-- into metrics so a receipt can show its own arithmetic:
--
--   10 / unit  base — a confirmed rehoming
--   15 / unit  the requirement was high or critical urgency
--   25 / unit  electronics kept out of waste via refurbishment or recycling
--   +20        once per confirmed handoff, for completing the verified loop
--
-- The rates do not stack: the highest applicable per-unit rate is used, then
-- the completion bonus is added once.

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
  v_req public.requirements;
  v_rate integer := 10;
  v_reason text := 'base';
  v_bonus integer := 20;
  v_diverted boolean;
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

  update public.handoffs
     set status = 'completed', recipient_confirmed_at = now(), completed_at = now()
   where allocation_id = p_allocation_id;

  update public.items
     set quantity_handed_over = quantity_handed_over + v_alloc.quantity_allocated,
         status = case
           when quantity_handed_over + v_alloc.quantity_allocated >= quantity
             then 'second_life_confirmed'::public.item_state
           else 'handed_over'::public.item_state
         end
   where id = v_alloc.item_id
  returning * into v_item;

  select * into v_req from public.requirements where id = v_alloc.requirement_id;

  v_diverted :=
    coalesce(v_item.category, '') ~* '(electronic|computer|phone|laptop|appliance|e-?waste)'
    and coalesce(v_item.destination_path, '') ~* '(recycl|refurbish)';

  if v_diverted then
    v_rate := 25;
    v_reason := 'electronics_diverted';
  elsif v_req.urgency in ('high', 'critical') then
    v_rate := 15;
    v_reason := 'urgent_requirement';
  end if;

  insert into public.impact_records (
    user_id, item_id, organization_id, allocation_id, outcome, destination,
    destination_tier, quantity, points, metrics
  )
  values (
    v_alloc.donor_id, v_alloc.item_id, v_alloc.organization_id, v_alloc.id,
    'second_life_confirmed', v_item.destination_path, v_item.destination_path,
    v_alloc.quantity_allocated,
    v_alloc.quantity_allocated * v_rate + v_bonus,
    jsonb_build_object(
      'category', v_item.category,
      'item_type', v_item.item_type,
      'rate_per_unit', v_rate,
      'rate_reason', v_reason,
      'verified_handoff_bonus', v_bonus,
      'urgency', v_req.urgency
    )
  )
  on conflict do nothing;

  return v_alloc;
end;
$$;

grant execute on function public.confirm_second_life(uuid) to authenticated;

-- ── 4. Demo destination network ────────────────────────────────────────────
--
-- Fictional organizations, marked as demo in their own description so nobody
-- mistakes them for real partners. They are seeded as directory rows (no
-- owner) and are claimed by the matching demo login the first time it signs up
-- — see private.claim_demo_organization() below. Contact addresses use the
-- reserved .test domain, which cannot receive mail.

insert into public.organizations (
  id, owner_id, name, org_type, description, location,
  latitude, longitude, contact_email, verification_status, is_directory
)
values
  (
    'aaaa1111-1111-4111-8111-111111111111', null,
    'Bright Future School', 'government_school',
    'Demo organization. Government school seeking textbooks, notebooks, stationery, school bags and computers for its classrooms.',
    'Vellore, Tamil Nadu', 12.9165, 79.1325,
    'brightfuture.demo@rehome.test', 'verified', true
  ),
  (
    'aaaa2222-2222-4222-8222-222222222222', null,
    'GreenCycle Foundation', 'recycler',
    'Demo organization. Certified recycling and sustainability partner taking e-waste, recyclable electronics, metal and cardboard.',
    'Bengaluru, Karnataka', 12.9716, 77.5946,
    'greencycle.demo@rehome.test', 'verified', true
  ),
  (
    'aaaa3333-3333-4333-8333-333333333333', null,
    'Udaan Community Centre', 'community',
    'Demo organization. Community NGO distributing clothes, books, furniture and toys to families in the neighbourhood.',
    'Chennai, Tamil Nadu', 13.0827, 80.2707,
    'udaan.demo@rehome.test', 'verified', true
  ),
  (
    'aaaa4444-4444-4444-8444-444444444444', null,
    'ReTech Refurbishment Hub', 'refurbisher',
    'Demo organization. Refurbisher restoring laptops, phones, monitors and repairable electronics for reuse.',
    'Coimbatore, Tamil Nadu', 11.0168, 76.9558,
    'retech.demo@rehome.test', 'verified', true
  ),
  (
    'aaaa5555-5555-4555-8555-555555555555', null,
    'Asha Children''s Centre', 'shelter',
    'Demo organization. Residential child-care centre needing books, bags, stationery, toys and clothing.',
    'Vellore, Tamil Nadu', 12.9250, 79.1500,
    'asha.demo@rehome.test', 'verified', true
  )
on conflict (id) do nothing;

insert into public.requirements (
  organization_id, category, subcategory, item_type, quantity_requested,
  required_condition, location, latitude, longitude, urgency, status
)
select
  v.organization_id, v.category, v.subcategory, v.item_type, v.quantity,
  v.required_condition, v.location, v.latitude, v.longitude, v.urgency, 'open'::public.requirement_status
from (
  values
    ('aaaa1111-1111-4111-8111-111111111111'::uuid, 'Education', 'Books', 'Textbook', 40, 'Good', 'Vellore, Tamil Nadu', 12.9165, 79.1325, 'high'::public.urgency_level),
    ('aaaa1111-1111-4111-8111-111111111111'::uuid, 'Education', 'Stationery', 'Notebook', 100, 'Any', 'Vellore, Tamil Nadu', 12.9165, 79.1325, 'medium'::public.urgency_level),
    ('aaaa1111-1111-4111-8111-111111111111'::uuid, 'Education', 'Bags', 'School Bag', 35, 'Any', 'Vellore, Tamil Nadu', 12.9165, 79.1325, 'high'::public.urgency_level),
    ('aaaa1111-1111-4111-8111-111111111111'::uuid, 'Electronics', 'Computers', 'Computer', 10, 'Repairable', 'Vellore, Tamil Nadu', 12.9165, 79.1325, 'medium'::public.urgency_level),

    ('aaaa2222-2222-4222-8222-222222222222'::uuid, 'Electronics', 'E-waste', 'E-waste', 200, 'Any', 'Bengaluru, Karnataka', 12.9716, 77.5946, 'medium'::public.urgency_level),
    ('aaaa2222-2222-4222-8222-222222222222'::uuid, 'Electronics', 'Appliances', 'Recyclable Electronics', 80, 'Any', 'Bengaluru, Karnataka', 12.9716, 77.5946, 'medium'::public.urgency_level),
    ('aaaa2222-2222-4222-8222-222222222222'::uuid, 'Home', 'Materials', 'Metal', 150, 'Any', 'Bengaluru, Karnataka', 12.9716, 77.5946, 'low'::public.urgency_level),
    ('aaaa2222-2222-4222-8222-222222222222'::uuid, 'Home', 'Materials', 'Cardboard', 300, 'Any', 'Bengaluru, Karnataka', 12.9716, 77.5946, 'low'::public.urgency_level),

    ('aaaa3333-3333-4333-8333-333333333333'::uuid, 'Clothing', 'Apparel', 'Clothing', 120, 'Wearable', 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'high'::public.urgency_level),
    ('aaaa3333-3333-4333-8333-333333333333'::uuid, 'Education', 'Books', 'Book', 60, 'Any', 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'medium'::public.urgency_level),
    ('aaaa3333-3333-4333-8333-333333333333'::uuid, 'Furniture', 'Seating', 'Chair', 25, 'Good', 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'medium'::public.urgency_level),
    ('aaaa3333-3333-4333-8333-333333333333'::uuid, 'Education', 'Toys', 'Toy', 70, 'Any', 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'low'::public.urgency_level),

    ('aaaa4444-4444-4444-8444-444444444444'::uuid, 'Electronics', 'Computers', 'Laptop', 30, 'Repairable', 'Coimbatore, Tamil Nadu', 11.0168, 76.9558, 'high'::public.urgency_level),
    ('aaaa4444-4444-4444-8444-444444444444'::uuid, 'Electronics', 'Phones', 'Mobile Phone', 45, 'Repairable', 'Coimbatore, Tamil Nadu', 11.0168, 76.9558, 'medium'::public.urgency_level),
    ('aaaa4444-4444-4444-8444-444444444444'::uuid, 'Electronics', 'Displays', 'Monitor', 20, 'Repairable', 'Coimbatore, Tamil Nadu', 11.0168, 76.9558, 'medium'::public.urgency_level),

    ('aaaa5555-5555-4555-8555-555555555555'::uuid, 'Education', 'Books', 'Book', 50, 'Any', 'Vellore, Tamil Nadu', 12.9250, 79.1500, 'high'::public.urgency_level),
    ('aaaa5555-5555-4555-8555-555555555555'::uuid, 'Education', 'Bags', 'School Bag', 30, 'Any', 'Vellore, Tamil Nadu', 12.9250, 79.1500, 'medium'::public.urgency_level),
    ('aaaa5555-5555-4555-8555-555555555555'::uuid, 'Education', 'Toys', 'Toy', 40, 'Any', 'Vellore, Tamil Nadu', 12.9250, 79.1500, 'low'::public.urgency_level),
    ('aaaa5555-5555-4555-8555-555555555555'::uuid, 'Clothing', 'Apparel', 'Clothing', 80, 'Wearable', 'Vellore, Tamil Nadu', 12.9250, 79.1500, 'medium'::public.urgency_level)
) as v(organization_id, category, subcategory, item_type, quantity, required_condition, location, latitude, longitude, urgency)
where not exists (
  select 1 from public.requirements r
  where r.organization_id = v.organization_id and r.item_type = v.item_type
);

-- ── 5. Claiming a demo organization ────────────────────────────────────────
--
-- Development seam, and scoped as narrowly as it can be: exactly five hard-coded
-- addresses on the reserved .test domain, which cannot receive mail and so
-- cannot be registered by anyone acting in good faith outside this project.
-- When one of them signs up, the matching seeded organization becomes theirs
-- and stops being a directory row.
--
-- Remove this section before any deployment that carries real users.

create or replace function private.claim_demo_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select id into v_org_id
  from public.organizations
  where contact_email = new.email
    and is_directory = true
    and contact_email like '%@rehome.test';

  if v_org_id is null then
    return new;
  end if;

  -- The signup trigger has already made a plain organization for this user;
  -- the demo row replaces it so the seeded requirements come with it.
  delete from public.organizations where owner_id = new.id and id <> v_org_id;

  update public.organizations
     set owner_id = new.id,
         is_directory = false
   where id = v_org_id;

  return new;
end;
$$;

revoke all on function private.claim_demo_organization() from public, anon, authenticated;

drop trigger if exists on_auth_user_claim_demo_org on auth.users;
create trigger on_auth_user_claim_demo_org
  after insert on auth.users
  for each row execute function private.claim_demo_organization();

-- ── 6. A published destination can be named ────────────────────────────────
--
-- organizations_select_visible only exposed directory rows, verified rows and
-- your own. Everything else came back null through the nested select, so a
-- donor matched to an unverified organization saw "Organization" instead of a
-- name — no destination, no location, and therefore no journey.
--
-- Publishing demand into a shared matching network is itself the act of being
-- listed, so an organization with a live requirement is nameable. Verification
-- is reported separately and truthfully in the interface, including when it is
-- absent.

drop policy if exists organizations_select_visible on public.organizations;
create policy organizations_select_visible on public.organizations
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or is_directory = true
    or verification_status = 'verified'
    or exists (
      select 1 from public.requirements r
      where r.organization_id = organizations.id
        and r.status in ('open', 'partially_fulfilled')
    )
  );
