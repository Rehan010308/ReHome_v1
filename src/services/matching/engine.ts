import type { ItemRow, OrganizationRow, RequirementRow } from "@/types/database";

export interface MatchScoreResult {
  score: number;
  factors: string[];
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function tokens(value: string): string[] {
  return norm(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function overlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  ta.forEach((t) => {
    if (tb.has(t)) hit += 1;
  });
  return hit / Math.max(ta.size, tb.size);
}

/**
 * Weights are chosen so a flawless match lands on exactly 100 without being
 * clamped — otherwise good and perfect matches both read "100%" and the score
 * stops carrying information.
 *   category 28 + type 22 + condition 14 + reuse 8
 * + urgency 10 + proximity 12 + verified 4 + quantity 2 = 100
 */
const urgencyBoost: Record<string, number> = {
  low: 0,
  medium: 3,
  high: 7,
  critical: 10,
};

const conditionRank: Record<string, number> = {
  excellent: 4,
  good: 3,
  wearable: 3,
  usable: 3,
  fair: 2,
  repairable: 2,
  any: 1,
  unknown: 1,
  poor: 0,
};

function conditionFit(itemCondition: string, required: string): number {
  const have = conditionRank[norm(itemCondition)] ?? 1;
  const need = conditionRank[norm(required)] ?? 1;
  if (need <= 1) return 10;
  if (have >= need) return 14;
  if (have + 1 >= need) return 7;
  return 0;
}

function proximityHint(itemLoc: string | null | undefined, reqLoc: string | null | undefined): { points: number; label: string | null } {
  const a = norm(itemLoc);
  const b = norm(reqLoc);
  if (!a || !b) return { points: 4, label: "Location not fully specified" };
  if (a === b) return { points: 12, label: `Same location · ${reqLoc}` };
  if (a.includes(b) || b.includes(a) || overlap(a, b) > 0.3) {
    return { points: 9, label: `Nearby · ${reqLoc}` };
  }
  return { points: 3, label: `Different area · ${reqLoc}` };
}

/**
 * Weighted supply→demand score. Not a keyword search:
 * category/type fit, condition, reuse value, urgency, proximity, org verification.
 */
export function scoreItemAgainstRequirement(
  item: ItemRow,
  requirement: RequirementRow,
  organization: OrganizationRow | null
): MatchScoreResult {
  const factors: string[] = [];
  let score = 0;

  const categoryHit = norm(item.category) === norm(requirement.category);
  const typeHit = norm(item.item_type) === norm(requirement.item_type);
  const typeOverlap = Math.max(
    overlap(item.item_type, requirement.item_type),
    overlap(item.subcategory, requirement.subcategory),
    overlap(item.item_type, requirement.category)
  );

  // Relevance gate. Condition, proximity, urgency and verification describe how
  // *convenient* a handoff would be, not whether the organization can use the
  // item at all — so on their own they must never produce a match. Without this
  // a sofa scored 51 against a textbook requirement purely on context points.
  if (!categoryHit && !typeHit && typeOverlap < 0.2) {
    return { score: 0, factors: [] };
  }

  if (categoryHit) {
    score += 28;
    factors.push(`Exact item category · ${item.category}`);
  } else if (typeOverlap > 0.2) {
    score += 12;
    factors.push("Related category / type");
  }

  if (typeHit) {
    score += 22;
    factors.push(`Exact item type · ${item.item_type}`);
  } else if (typeOverlap >= 0.35) {
    score += Math.round(18 * typeOverlap);
    factors.push("Compatible item type");
  }

  const cond = conditionFit(item.condition, requirement.required_condition);
  score += cond;
  if (cond >= 10) factors.push(`Suitable condition · ${item.condition}`);

  const reuse = Number(item.reusability_score) || 50;
  if (reuse >= 70) {
    score += 8;
    factors.push("High reuse potential");
  } else if (reuse >= 40) {
    score += 4;
    factors.push("Moderate reuse potential");
  }

  const urg = urgencyBoost[requirement.urgency] ?? 4;
  score += urg;
  if (requirement.urgency === "high" || requirement.urgency === "critical") {
    factors.push(`Organization currently needs this item · ${requirement.urgency} urgency`);
  } else {
    factors.push("Open requirement");
  }

  const prox = proximityHint(item.location, requirement.location ?? organization?.location);
  score += prox.points;
  if (prox.label) factors.push(prox.label);

  if (organization?.verification_status === "verified" || organization?.is_directory) {
    score += 4;
    factors.push(`${organization.name} is a verified destination`);
  }

  if (requirement.quantity >= 10) {
    score += 2;
    factors.push(`Quantity requested · ${requirement.quantity}`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
  };
}

export function reusabilityScoreFromLabel(label: string, confidence: number): number {
  const text = label.toLowerCase();
  if (text.includes("high")) return Math.min(100, Math.max(70, Math.round(confidence)));
  if (text.includes("moderate") || text.includes("medium")) return 58;
  if (text.includes("low") || text.includes("material") || text.includes("recycl")) return 28;
  return Math.max(0, Math.min(100, Math.round(confidence || 50)));
}
