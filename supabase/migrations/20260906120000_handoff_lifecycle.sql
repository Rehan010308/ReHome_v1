-- ReHome — verified handoff lifecycle.
--
--   ALLOCATED → HANDOFF_SCHEDULED → HANDED_OVER → CONFIRMED
--
-- Every transition is an RPC that checks who is allowed to make it. Direct
-- UPDATE on match_allocations is revoked, because leaving `status` writable
-- let either party set 'confirmed' themselves — skipping confirm_second_life,
-- and so recording a completed handoff with no impact behind it.
--
-- Idempotent. Apply after 20260906090000_allocation_and_geospatial.sql.

drop policy if exists allocations_update_parties on public.match_allocations;
revoke update on public.match_allocations from authenticated;

do $$ begin
  alter table public.handoffs add constraint handoffs_allocation_unique unique (allocation_id);
exception when duplicate_object then null; end $$;

create index if not exists handoffs_allocation_idx on public.handoffs (allocation_id);

-- ── Who is party to an allocation ──────────────────────────────────────────
create or replace function private.allocation_role(p_allocation_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when a.donor_id = (select auth.uid()) then 'donor'
    when exists (
      select 1 from public.organizations o
      where o.id = a.organization_id and o.owner_id = (select auth.uid())
    ) then 'organization'
    else null
  end
  from public.match_allocations a
  where a.id = p_allocation_id;
$$;

revoke all on function private.allocation_role(uuid) from public, anon, authenticated;
grant execute on function private.allocation_role(uuid) to authenticated;

-- ── Schedule ───────────────────────────────────────────────────────────────
-- Either party may propose the arrangement; the other sees it immediately.
create or replace function public.schedule_handoff(
  p_allocation_id uuid,
  p_scheduled_for timestamptz,
  p_location text default null,
  p_notes text default null
)
returns public.match_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.allocation_role(p_allocation_id);
  v_alloc public.match_allocations;
begin
  if v_role is null then
    raise exception 'You are not part of this handoff';
  end if;

  select * into v_alloc from public.match_allocations where id = p_allocation_id for update;
  if v_alloc.status in ('confirmed', 'cancelled') then
    raise exception 'This handoff is already closed';
  end if;

  insert into public.handoffs (
    item_id, organization_id, match_id, allocation_id, quantity,
    scheduled_for, handoff_location, notes, status
  )
  values (
    v_alloc.item_id, v_alloc.organization_id, v_alloc.match_id, v_alloc.id,
    v_alloc.quantity_allocated, p_scheduled_for, p_location, p_notes, 'scheduled'
  )
  on conflict (allocation_id) do update
    set scheduled_for = excluded.scheduled_for,
        handoff_location = excluded.handoff_location,
        notes = coalesce(excluded.notes, public.handoffs.notes),
        status = 'scheduled';

  update public.match_allocations
     set status = 'handoff_scheduled'
   where id = p_allocation_id
  returning * into v_alloc;

  update public.items set status = 'handoff_scheduled'
   where id = v_alloc.item_id and status not in ('handed_over', 'second_life_confirmed');

  return v_alloc;
end;
$$;

-- ── Donor hands over ───────────────────────────────────────────────────────
-- The donor asserts they physically handed the item across. This is a claim,
-- not proof — it is not impact, and the recipient still has to confirm.
create or replace function public.mark_handed_over(p_allocation_id uuid)
returns public.match_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.allocation_role(p_allocation_id);
  v_alloc public.match_allocations;
begin
  if v_role <> 'donor' then
    raise exception 'Only the donor can mark an item as handed over';
  end if;

  select * into v_alloc from public.match_allocations where id = p_allocation_id for update;
  if v_alloc.status in ('confirmed', 'cancelled') then
    raise exception 'This handoff is already closed';
  end if;

  update public.match_allocations set status = 'handed_over'
   where id = p_allocation_id
  returning * into v_alloc;

  update public.handoffs
     set donor_confirmed_at = now(), status = 'in_progress'
   where allocation_id = p_allocation_id;

  update public.items set status = 'handed_over'
   where id = v_alloc.item_id and status <> 'second_life_confirmed';

  return v_alloc;
end;
$$;

-- ── Cancel ─────────────────────────────────────────────────────────────────
-- Releases the reserved quantity back to both sides. Without this, a withdrawn
-- contribution would strand demand as permanently met.
create or replace function public.cancel_allocation(p_allocation_id uuid)
returns public.match_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.allocation_role(p_allocation_id);
  v_alloc public.match_allocations;
  v_received integer;
begin
  if v_role is null then
    raise exception 'You are not part of this handoff';
  end if;

  select * into v_alloc from public.match_allocations where id = p_allocation_id for update;
  if v_alloc.status = 'confirmed' then
    raise exception 'A confirmed handoff cannot be cancelled';
  end if;
  if v_alloc.status = 'cancelled' then
    return v_alloc;
  end if;

  -- Lock the requirement before adjusting its running total.
  perform 1 from public.requirements where id = v_alloc.requirement_id for update;

  update public.requirements
     set quantity_received = greatest(0, quantity_received - v_alloc.quantity_allocated)
   where id = v_alloc.requirement_id
  returning quantity_received into v_received;

  update public.requirements
     set status = case
       when v_received = 0 then 'open'::public.requirement_state
       when v_received >= quantity_requested then 'fulfilled'::public.requirement_state
       else 'partially_fulfilled'::public.requirement_state
     end
   where id = v_alloc.requirement_id;

  update public.items
     set quantity_allocated = greatest(0, quantity_allocated - v_alloc.quantity_allocated),
         status = 'matched'::public.item_state
   where id = v_alloc.item_id;

  update public.match_allocations set status = 'cancelled'
   where id = p_allocation_id
  returning * into v_alloc;

  update public.handoffs set status = 'cancelled' where allocation_id = p_allocation_id;

  if v_alloc.match_id is not null then
    update public.matches set status = 'cancelled' where id = v_alloc.match_id;
  end if;

  return v_alloc;
end;
$$;

-- ── Confirmation also closes the handoff record ────────────────────────────
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
  )
  on conflict do nothing;

  return v_alloc;
end;
$$;

grant execute on function public.schedule_handoff(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.mark_handed_over(uuid) to authenticated;
grant execute on function public.cancel_allocation(uuid) to authenticated;
