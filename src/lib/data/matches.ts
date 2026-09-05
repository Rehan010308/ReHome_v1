import { requireSupabase } from "@/lib/supabase";
import type { ItemRow, MatchRow, MatchWithContext, RequirementWithOrg } from "@/types/database";
import { listOpenRequirements, updateItemStatus } from "./catalog";
import { listVisibleOrganizations } from "./profiles";
import { scoreItemAgainstRequirement, type MatchFactor } from "@/services/matching/engine";

/** Factors are stored as jsonb; tolerate the older plain-string shape. */
function asFactors(value: unknown): MatchFactor[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) =>
    typeof entry === "string"
      ? { label: entry, kind: "positive" as const }
      : {
          label: String((entry as MatchFactor)?.label ?? ""),
          kind: (entry as MatchFactor)?.kind === "caution" ? "caution" : "positive",
        }
  );
}

function hydrate(row: Record<string, unknown>): MatchWithContext {
  return {
    ...(row as unknown as MatchRow),
    matching_factors: asFactors(row.matching_factors) as unknown as string[],
    item: (row.item as ItemRow | null) ?? null,
    requirement: (row.requirement as RequirementWithOrg | null) ?? null,
  };
}

const CONTEXT = `
  *,
  item:items(*),
  requirement:requirements(*, organization:organizations(*))
`;

/** Suggestions only — scoring an item never commits or fulfills anything. */
export async function persistMatchesForItem(item: ItemRow): Promise<MatchRow[]> {
  const [requirements, organizations] = await Promise.all([
    listOpenRequirements(),
    listVisibleOrganizations(),
  ]);
  const orgById = new Map(organizations.map((o) => [o.id, o]));

  const scored = requirements
    .map((requirement) => ({
      requirement,
      ...scoreItemAgainstRequirement(item, requirement, orgById.get(requirement.organization_id) ?? null),
    }))
    .filter((row) => row.score >= 40 && row.quantityOffered > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const saved: MatchRow[] = [];
  for (const row of scored) {
    const { data, error } = await requireSupabase()
      .from("matches")
      .upsert(
        {
          item_id: item.id,
          requirement_id: row.requirement.id,
          match_score: row.score,
          matching_factors: row.factors,
          quantity_offered: row.quantityOffered,
          confidence: item.confidence,
          distance_km: row.distanceKm,
          needs_type_confirmation: row.needsTypeConfirmation,
          scored_at: new Date().toISOString(),
        },
        { onConflict: "item_id,requirement_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    saved.push(data as MatchRow);
  }

  // "matched" means suggestions exist — not that anything has been committed.
  if (saved.length > 0 && (item.status === "listed" || item.status === "confirmed")) {
    await updateItemStatus(item.id, "matched");
  }

  return saved;
}

export async function listMatchesForOwner(userId: string): Promise<MatchWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("matches")
    .select(CONTEXT)
    .in("status", ["suggested", "accepted"])
    .order("match_score", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(hydrate)
    .filter((row) => row.item?.owner_id === userId);
}

export async function listMatchesForOrganization(organizationId: string): Promise<MatchWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("matches")
    .select(CONTEXT)
    .order("match_score", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(hydrate)
    .filter((row) => row.requirement?.organization_id === organizationId);
}

export async function setMatchStatus(id: string, status: MatchRow["status"]): Promise<void> {
  const { error } = await requireSupabase().from("matches").update({ status }).eq("id", id);
  if (error) throw error;
}
