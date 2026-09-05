import { requireSupabase } from "@/lib/supabase";
import type { ItemRow, MatchRow, MatchWithContext, OrganizationRow, RequirementRow } from "@/types/database";
import { listOpenRequirements, updateItemStatus } from "./catalog";
import { listVisibleOrganizations } from "./profiles";
import { scoreItemAgainstRequirement } from "@/services/matching/engine";

function asFactors(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export async function persistMatchesForItem(item: ItemRow): Promise<MatchRow[]> {
  const [requirements, organizations] = await Promise.all([
    listOpenRequirements(),
    listVisibleOrganizations(),
  ]);
  const orgById = new Map(organizations.map((o) => [o.id, o]));
  const scored = requirements
    .map((requirement) => {
      const org = orgById.get(requirement.organization_id) ?? null;
      return {
        requirement,
        ...scoreItemAgainstRequirement(item, requirement, org),
      };
    })
    .filter((row) => row.score >= 40)
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
          scored_at: new Date().toISOString(),
        },
        { onConflict: "item_id,requirement_id" }
      )
      .select("*")
      .single();
    if (error) {
      const retry = await requireSupabase()
        .from("matches")
        .upsert(
          {
            item_id: item.id,
            requirement_id: row.requirement.id,
            match_score: row.score,
            matching_factors: row.factors,
          },
          { onConflict: "item_id,requirement_id" }
        )
        .select("*")
        .single();
      if (retry.error) throw error;
      saved.push({ ...(retry.data as MatchRow), matching_factors: asFactors((retry.data as MatchRow).matching_factors) });
      continue;
    }
    saved.push({ ...(data as MatchRow), matching_factors: asFactors((data as MatchRow).matching_factors) });
  }

  if (saved.length > 0 && item.status === "listed") {
    await updateItemStatus(item.id, "matched");
  }

  return saved;
}

export async function listMatchesForOwner(userId: string): Promise<MatchWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("matches")
    .select(
      `
      *,
      item:items(*),
      requirement:requirements(*, organization:organizations(*))
    `
    )
    .order("match_score", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      ...(row as unknown as MatchRow),
      matching_factors: asFactors(row.matching_factors),
      item: (row.item as ItemRow | null) ?? null,
      requirement: (row.requirement as (RequirementRow & { organization: OrganizationRow | null }) | null) ?? null,
    }))
    .filter((row) => row.item?.owner_id === userId);
}

export async function listMatchesForOrganization(organizationId: string): Promise<MatchWithContext[]> {
  const { data, error } = await requireSupabase()
    .from("matches")
    .select(
      `
      *,
      item:items(*),
      requirement:requirements(*, organization:organizations(*))
    `
    )
    .order("match_score", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      ...(row as unknown as MatchRow),
      matching_factors: asFactors(row.matching_factors),
      item: (row.item as ItemRow | null) ?? null,
      requirement: (row.requirement as (RequirementRow & { organization: OrganizationRow | null }) | null) ?? null,
    }))
    .filter((row) => row.requirement?.organization_id === organizationId);
}

export async function setMatchStatus(id: string, status: MatchRow["status"]): Promise<void> {
  const { error } = await requireSupabase().from("matches").update({ status }).eq("id", id);
  if (error) throw error;
}
