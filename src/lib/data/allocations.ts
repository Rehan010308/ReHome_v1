import { requireSupabase } from "@/lib/supabase";
import type { AllocationWithContext, MatchAllocationRow } from "@/types/database";

const CONTEXT = `
  *,
  item:items(*),
  requirement:requirements(*, organization:organizations(*))
`;

/**
 * Commit part of an item to a requirement.
 *
 * Goes through the allocate_to_requirement RPC rather than writing tables
 * directly: the function locks the requirement and item rows before reading
 * their remaining capacity, so two donors racing for the last unit serialise
 * instead of both succeeding. A CHECK constraint backs this up, so even a bug
 * here cannot record more contributions than were requested.
 */
export async function allocateToRequirement(input: {
  itemId: string;
  requirementId: string;
  quantity: number;
  matchId?: string | null;
}): Promise<MatchAllocationRow> {
  const { data, error } = await requireSupabase().rpc("allocate_to_requirement", {
    p_item_id: input.itemId,
    p_requirement_id: input.requirementId,
    p_quantity: input.quantity,
    p_match_id: input.matchId ?? null,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as MatchAllocationRow;
}

export async function listDonorAllocations(donorId: string): Promise<AllocationWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("match_allocations")
    .select(CONTEXT)
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AllocationWithContext[];
}

export async function listOrganizationAllocations(
  organizationId: string
): Promise<AllocationWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("match_allocations")
    .select(CONTEXT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AllocationWithContext[];
}

/**
 * Requirement-level aggregation across every donor who has contributed.
 * The requirement row's own quantity_received is authoritative; this exists to
 * show *who* contributed, never to recompute the total.
 */
export async function listRequirementContributions(
  requirementId: string
): Promise<MatchAllocationRow[]> {
  const { data, error } = await requireSupabase()
    .from("match_allocations")
    .select("*")
    .eq("requirement_id", requirementId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MatchAllocationRow[];
}
