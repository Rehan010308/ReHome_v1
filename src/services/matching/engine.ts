import type { ItemRow, OrganizationRow, RequirementRow } from "@/types/database";
import { coordsOf, distanceKm, formatDistance } from "@/services/geo";
import { assessDestination } from "@/services/destination/engine";

/**
 * Supply → demand scoring.
 *
 * Two rules shape this engine:
 *
 * 1. Relevance gates everything. Condition, distance, urgency and verification
 *    describe how *convenient* a handoff would be, never whether the item is
 *    usable at all, so they cannot produce a match on their own.
 *
 * 2. Certainty is never overstated. An item type that came from an unconfirmed
 *    detection scores lower than a confirmed one and is labelled as needing
 *    confirmation — "Book" is not "Mathematics Textbook" until someone says so.
 *
 * Weights total exactly 100 so a perfect match reads 100 without clamping:
 *   type/category 38 + condition 15 + demand 10 + urgency 10
 * + proximity 14 + reuse 7 + verification 6
 */

export type FactorKind = "positive" | "caution";

export interface MatchFactor {
  label: string;
  kind: FactorKind;
}

export interface MatchScoreResult {
  score: number;
  factors: MatchFactor[];
  /** True when the item type is an unconfirmed machine guess. */
  needsTypeConfirmation: boolean;
  distanceKm: number | null;
  /** How many units this item could actually contribute right now. */
  quantityOffered: number;
  /** Demand still outstanding after this contribution. */
  demandRemainingAfter: number;
}

/** Legacy string list, for surfaces that only render plain factors. */
export function factorLabels(factors: MatchFactor[]): string[] {
  return factors.map((f) => f.label);
}

const norm = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

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

const conditionRank: Record<string, number> = {
  excellent: 4, good: 3, wearable: 3, usable: 3, clean: 3, working: 3,
  fair: 2, repairable: 2, any: 1, unknown: 1, poor: 0, broken: 0,
};

function conditionFit(itemCondition: string, required: string): number {
  const have = conditionRank[norm(itemCondition)] ?? 1;
  const need = conditionRank[norm(required)] ?? 1;
  if (need <= 1) return 11;
  if (have >= need) return 15;
  if (have + 1 >= need) return 7;
  return 0;
}

const urgencyPoints: Record<string, number> = { low: 0, medium: 4, high: 8, critical: 10 };

/**
 * Proximity points fall off with distance but are capped at 14 — well below the
 * 38 available for item fit. That is deliberate: an exact item 10 km away must
 * be able to beat the wrong item 1 km away.
 */
function proximityPoints(km: number | null): number {
  if (km === null) return 5;
  if (km <= 2) return 14;
  if (km <= 5) return 12;
  if (km <= 10) return 10;
  if (km <= 25) return 7;
  if (km <= 50) return 4;
  return 1;
}

/**
 * An item's type is trustworthy when the user confirmed or corrected it, or
 * when the classifier was confident. Otherwise it is a guess and must be
 * treated as one.
 */
export function isTypeConfirmed(item: Pick<ItemRow, "user_corrected" | "confidence" | "ai_source">): boolean {
  if (item.user_corrected) return true;
  if (item.ai_source === "manual") return true;
  return (item.confidence ?? 0) >= 75;
}

/** Organization types that can lawfully take material for recovery or repair. */
const RECOVERY_ORG_TYPES = /recycl|refurbish|scrap|waste|e-?waste|repair/;

function acceptsRecovery(organization: OrganizationRow | null): boolean {
  if (!organization) return false;
  return RECOVERY_ORG_TYPES.test(norm(organization.org_type));
}

export function scoreItemAgainstRequirement(
  item: ItemRow,
  requirement: RequirementRow,
  organization: OrganizationRow | null
): MatchScoreResult {
  const factors: MatchFactor[] = [];
  let score = 0;

  const itemCoords = coordsOf(item);
  const reqCoords = coordsOf(requirement) ?? (organization ? coordsOf(organization) : null);
  const km = itemCoords && reqCoords ? Number(distanceKm(itemCoords, reqCoords).toFixed(2)) : null;

  const available = Math.max(0, Number(item.quantity_available ?? item.quantity ?? 1));
  const remaining = Math.max(0, Number(requirement.quantity_remaining ?? requirement.quantity_requested));
  const quantityOffered = Math.min(available, remaining);

  const empty: MatchScoreResult = {
    score: 0, factors: [], needsTypeConfirmation: false,
    distanceKm: km, quantityOffered: 0, demandRemainingAfter: remaining,
  };

  // Nothing left to give, or nothing left to need.
  if (available <= 0 || remaining <= 0) return empty;

  // Hazardous and unsuitable items are routed by what they are, not by demand.
  // They must never be offered to a school, shelter or kitchen however well the
  // category lines up — only to organizations equipped to process them.
  const assessment = assessDestination({
    category: item.category,
    subCategory: item.subcategory,
    itemType: item.item_type,
    condition: item.condition,
  });
  if (assessment.hazard && !acceptsRecovery(organization)) return empty;
  if (assessment.hazard) {
    factors.push({
      label: `Not suitable for reuse — routed to ${organization?.name ?? "a recovery partner"} for ${
        assessment.primary.tier === "recycling" ? "materials recovery" : "responsible disposal"
      }`,
      kind: "caution",
    });
  }

  const categoryHit = norm(item.category) === norm(requirement.category);
  const typeHit = norm(item.item_type) === norm(requirement.item_type);
  const typeOverlap = Math.max(
    overlap(item.item_type, requirement.item_type),
    overlap(item.subcategory, requirement.subcategory),
    overlap(item.item_type, requirement.category)
  );

  // Relevance gate.
  if (!categoryHit && !typeHit && typeOverlap < 0.2) return empty;

  const confirmed = isTypeConfirmed(item);
  const needsTypeConfirmation = !confirmed;

  // ── Item fit (38) ────────────────────────────────────────────────────────
  if (typeHit && confirmed) {
    score += 38;
    factors.push({ label: `Exactly what they asked for — ${requirement.item_type}`, kind: "positive" });
  } else if (typeHit) {
    score += 27;
    factors.push({ label: `Looks like ${requirement.item_type}, but the type is unconfirmed`, kind: "caution" });
  } else if (categoryHit && typeOverlap >= 0.35) {
    score += confirmed ? 26 : 20;
    factors.push({ label: `Compatible with ${requirement.item_type}`, kind: "positive" });
  } else if (categoryHit) {
    score += confirmed ? 18 : 14;
    factors.push({ label: `Same category — they need ${requirement.category.toLowerCase()}`, kind: "positive" });
  } else {
    score += 8;
    factors.push({ label: `Possible match — item type needs confirmation`, kind: "caution" });
  }

  if (needsTypeConfirmation && !(typeHit && confirmed)) {
    factors.push({ label: "Confirm what this item is to improve the match", kind: "caution" });
  }

  // ── Condition (15) ───────────────────────────────────────────────────────
  const cond = conditionFit(item.condition, requirement.required_condition);
  score += cond;
  if (norm(item.condition).includes("unknown")) {
    factors.push({ label: "Condition not confirmed yet", kind: "caution" });
  } else if (cond >= 11) {
    factors.push({ label: `Condition suits their requirement — ${item.condition}`, kind: "positive" });
  } else if (cond === 0) {
    factors.push({ label: `They asked for ${requirement.required_condition.toLowerCase()} condition`, kind: "caution" });
  }

  // ── Demand contribution (10) ─────────────────────────────────────────────
  // A single unit against a large requirement is a real, valid contribution —
  // it just isn't fulfillment. Covering more of the gap scores higher, but
  // partial contributions are never penalised into irrelevance.
  const coverage = quantityOffered / remaining;
  score += coverage >= 1 ? 10 : coverage >= 0.5 ? 8 : coverage >= 0.2 ? 6 : 4;
  factors.push({
    label:
      quantityOffered >= remaining
        ? `Covers the remaining ${remaining} they need`
        : `Contributes ${quantityOffered} of ${remaining} still needed`,
    kind: "positive",
  });

  // ── Urgency (10) ─────────────────────────────────────────────────────────
  score += urgencyPoints[requirement.urgency] ?? 4;
  if (requirement.urgency === "high" || requirement.urgency === "critical") {
    factors.push({ label: "They need this urgently", kind: "positive" });
  }

  // ── Proximity (14) ───────────────────────────────────────────────────────
  score += proximityPoints(km);
  const distanceLabel = formatDistance(km);
  if (distanceLabel) {
    factors.push({
      label: km !== null && km <= 25 ? `Nearby handoff — ${distanceLabel}` : `${distanceLabel}`,
      kind: km !== null && km <= 25 ? "positive" : "caution",
    });
  } else {
    factors.push({ label: "Distance unknown — add a location to improve ranking", kind: "caution" });
  }

  if (km !== null && organization && km > Number(organization.service_radius_km ?? 25)) {
    factors.push({ label: "Outside this organization's usual collection area", kind: "caution" });
  }

  // ── Reuse potential (7) ──────────────────────────────────────────────────
  const reuse = Number(item.reusability_score) || 50;
  if (reuse >= 70) {
    score += 7;
    factors.push({ label: "High reuse potential — goes straight back into use", kind: "positive" });
  } else if (reuse >= 40) {
    score += 4;
  }

  // ── Verification (6) ─────────────────────────────────────────────────────
  if (organization?.verification_status === "verified") {
    score += 6;
    factors.push({ label: `${organization.name} is a verified organization`, kind: "positive" });
  } else if (organization) {
    factors.push({ label: `${organization.name} is not yet verified`, kind: "caution" });
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
    needsTypeConfirmation,
    distanceKm: km,
    quantityOffered,
    demandRemainingAfter: Math.max(0, remaining - quantityOffered),
  };
}

export function reusabilityScoreFromLabel(label: string, confidence: number): number {
  const text = label.toLowerCase();
  // Checked first: "None — safe handling required" is a reuse score of nearly
  // zero, and must not fall through to the confidence of the detection.
  if (text.includes("none") || text.includes("safe handling")) return 5;
  if (text.includes("high")) return Math.min(100, Math.max(70, Math.round(confidence)));
  if (text.includes("moderate") || text.includes("medium")) return 58;
  if (text.includes("low") || text.includes("material") || text.includes("recycl")) return 28;
  return Math.max(0, Math.min(100, Math.round(confidence || 50)));
}
