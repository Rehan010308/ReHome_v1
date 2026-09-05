import { requireSupabase } from "@/lib/supabase";
import type { AllocationStatus, MatchAllocationRow } from "@/types/database";

/**
 * Every transition is an RPC. Direct writes to match_allocations.status are
 * revoked, so the database — not the interface — decides who may advance a
 * handoff and in which direction.
 */
async function callRpc(fn: string, args: Record<string, unknown>): Promise<MatchAllocationRow> {
  const { data, error } = await requireSupabase().rpc(fn, args);
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as MatchAllocationRow;
}

export function scheduleHandoff(input: {
  allocationId: string;
  scheduledFor: string;
  location?: string;
  notes?: string;
}): Promise<MatchAllocationRow> {
  return callRpc("schedule_handoff", {
    p_allocation_id: input.allocationId,
    p_scheduled_for: input.scheduledFor,
    p_location: input.location ?? null,
    p_notes: input.notes ?? null,
  });
}

/** Donor's claim that the item changed hands. Not impact — the recipient still confirms. */
export function markHandedOver(allocationId: string): Promise<MatchAllocationRow> {
  return callRpc("mark_handed_over", { p_allocation_id: allocationId });
}

/** Recipient-side confirmation. The only path that writes impact. */
export function confirmSecondLife(allocationId: string): Promise<MatchAllocationRow> {
  return callRpc("confirm_second_life", { p_allocation_id: allocationId });
}

/** Releases the reserved quantity back to the requirement and the item. */
export function cancelAllocation(allocationId: string): Promise<MatchAllocationRow> {
  return callRpc("cancel_allocation", { p_allocation_id: allocationId });
}

export interface HandoffRow {
  id: string;
  allocation_id: string | null;
  scheduled_for: string | null;
  handoff_location: string | null;
  notes: string | null;
  status: string;
  donor_confirmed_at: string | null;
  recipient_confirmed_at: string | null;
}

export async function fetchHandoffsByAllocation(
  allocationIds: string[]
): Promise<Map<string, HandoffRow>> {
  if (allocationIds.length === 0) return new Map();
  const { data, error } = await requireSupabase()
    .from("handoffs")
    .select("id, allocation_id, scheduled_for, handoff_location, notes, status, donor_confirmed_at, recipient_confirmed_at")
    .in("allocation_id", allocationIds);
  if (error) throw error;
  const map = new Map<string, HandoffRow>();
  for (const row of (data ?? []) as HandoffRow[]) {
    if (row.allocation_id) map.set(row.allocation_id, row);
  }
  return map;
}

/** Ordered lifecycle, for rendering progress. */
export const HANDOFF_STAGES: AllocationStatus[] = [
  "allocated",
  "handoff_scheduled",
  "handed_over",
  "confirmed",
];

export const STAGE_LABEL: Record<AllocationStatus, string> = {
  allocated: "Committed",
  handoff_scheduled: "Scheduled",
  handed_over: "Handed over",
  confirmed: "Second life confirmed",
  cancelled: "Cancelled",
};
