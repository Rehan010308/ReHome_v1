import { requireSupabase } from "@/lib/supabase";
import type { ImpactRecordRow } from "@/types/database";

export interface ImpactSummary {
  /** Units actually handed over and confirmed — never requirement sizes. */
  unitsRehomed: number;
  organizationsSupported: number;
  points: number;
  byCategory: Array<{ category: string; units: number }>;
  records: ImpactRecordRow[];
}

export const EMPTY_IMPACT: ImpactSummary = {
  unitsRehomed: 0,
  organizationsSupported: 0,
  points: 0,
  byCategory: [],
  records: [],
};

/**
 * Impact is derived entirely from impact_records, which are written only by
 * confirm_second_life(). There is no counter to drift and nothing to fake: if
 * a handoff was never confirmed, it does not appear here.
 */
export async function fetchImpactSummary(userId: string): Promise<ImpactSummary> {
  const { data, error } = await requireSupabase()
    .from("impact_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const records = (data ?? []) as ImpactRecordRow[];
  const categories = new Map<string, number>();
  const orgs = new Set<string>();
  let unitsRehomed = 0;
  let points = 0;

  for (const row of records) {
    unitsRehomed += row.quantity;
    points += row.points;
    if (row.organization_id) orgs.add(row.organization_id);
    const category = String(row.metrics?.category ?? "Other");
    categories.set(category, (categories.get(category) ?? 0) + row.quantity);
  }

  return {
    unitsRehomed,
    organizationsSupported: orgs.size,
    points,
    byCategory: [...categories.entries()]
      .map(([category, units]) => ({ category, units }))
      .sort((a, b) => b.units - a.units),
    records,
  };
}
