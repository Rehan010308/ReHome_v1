/**
 * ReHome reuse-first destination engine.
 *
 * "We don't ask where you want to throw something away. We determine where it
 * can create the most value next."
 *
 * For every item this ranks the four realistic destinations and picks the
 * highest-value one the item's condition can actually support:
 *
 *   1. DIRECT REUSE      — the item works; someone can use it as-is
 *   2. REFURBISHMENT     — a fixable fault stands between it and reuse
 *   3. RECYCLING         — reuse is not realistic; recover the materials
 *   4. RESPONSIBLE DISPOSAL — unsafe or unrecoverable; handle it correctly
 *
 * The ordering is deliberately *not* "highest score wins". A tier earlier in
 * the ladder is preferred whenever it is viable at all, because the objective
 * is to maximise useful life, not to pick the most confident label.
 */

export type DestinationTier =
  | "direct_reuse"
  | "refurbishment"
  | "recycling"
  | "responsible_disposal";

export const TIER_ORDER: DestinationTier[] = [
  "direct_reuse",
  "refurbishment",
  "recycling",
  "responsible_disposal",
];

export const TIER_LABEL: Record<DestinationTier, string> = {
  direct_reuse: "Direct reuse / donation",
  refurbishment: "Refurbishment",
  recycling: "Recycling",
  responsible_disposal: "Responsible disposal",
};

/** How functional the item is, derived from free-text condition. */
export type ConditionBand =
  | "working"
  | "worn"
  | "minor_issue"
  /** Faulty, but repair has not been ruled out — assess before scrapping. */
  | "not_working"
  /** Explicitly beyond economic repair. */
  | "unrepairable"
  | "unsafe"
  | "unknown";

export interface DestinationInput {
  category: string;
  subCategory?: string;
  itemType: string;
  condition: string;
  reusability?: string;
}

export interface DestinationOption {
  tier: DestinationTier;
  label: string;
  recipient: string;
  /** 0–100: how realistic this destination is for this item right now. */
  viability: number;
  rationale: string;
  /** Rough estimate, in days, of the useful life this destination adds. */
  usefulLifeExtensionDays: number;
  available: boolean;
}

export interface DestinationAssessment {
  primary: DestinationOption;
  /** All four tiers, best-first, so the UI can show what was ruled out and why. */
  ladder: DestinationOption[];
  conditionBand: ConditionBand;
  /** True when the condition is still unconfirmed and the user should check. */
  needsConditionCheck: boolean;
  /** Set when the item itself — not merely its condition — rules out reuse. */
  hazard: HazardFinding | null;
  summary: string;
}

/**
 * Some objects can never be routed for ordinary reuse or donation, no matter
 * what state they are in. A pristine car battery is still a car battery.
 *
 * `reason` is written for the donor: it says what the constraint is, without
 * telling anyone to handle a hazard themselves.
 */
export interface HazardFinding {
  kind: "hazardous" | "unsuitable";
  /** Short name of the class matched, e.g. "battery". */
  klass: string;
  reason: string;
  /** The best tier this item can reach — never higher than recycling. */
  ceiling: Extract<DestinationTier, "recycling" | "responsible_disposal">;
}

const norm = (v: string | undefined | null) => (v ?? "").trim().toLowerCase();

/**
 * Condition arrives as free text — the vision baseline writes it, and the user
 * can edit it to anything before saving. Parse defensively; when in doubt
 * return "unknown" rather than assuming the worst, because assuming an item is
 * broken is the failure mode that sends reusable things to recycling.
 */
export function conditionBandOf(condition: string): ConditionBand {
  const c = norm(condition);
  if (!c) return "unknown";

  if (/unsafe|hazard|swollen|leaking|leak|mould|mold|biohazard|contaminat|corrod|expired|recall/.test(c)) {
    return "unsafe";
  }
  // Checked before the generic fault patterns: "broken beyond repair" must not
  // be read as merely "broken", or scrap gets routed to a refurbisher.
  if (/beyond (economic )?repair|un[- ]?repairable|non[- ]?repairable|not repairable|irreparable|shattered|scrap|write[- ]?off|destroyed/.test(c)) {
    return "unrepairable";
  }
  if (/not working|non[- ]?working|broken|dead|faulty|does ?n[o']?t work|e-?waste/.test(c)) {
    return "not_working";
  }
  if (/repairable|minor (issue|fault|damage)|needs? repair|slight(ly)? damaged|cracked|chipped|missing part|intermittent/.test(c)) {
    return "minor_issue";
  }
  if (/unknown|unconfirmed|confirm|not sure|unsure|untested/.test(c)) {
    return "unknown";
  }
  if (/excellent|like new|as new|new|good|working|functional|wearable|usable|clean|serviceable/.test(c)) {
    return "working";
  }
  if (/fair|worn|used|average|ok\b|okay/.test(c)) {
    return "worn";
  }
  if (/poor|heavily worn|damaged/.test(c)) {
    return "not_working";
  }
  return "unknown";
}

interface CategoryProfile {
  reuseRecipient: string;
  refurbRecipient: string;
  recycleRecipient: string;
  disposalRecipient: string;
  /** Whether refurbishment is a real pathway for this class of item. */
  repairable: boolean;
  recyclable: boolean;
  /** Typical useful life, in days, that a successful reuse adds. */
  reuseLifeDays: number;
  refurbLifeDays: number;
}

const DEFAULT_PROFILE: CategoryProfile = {
  reuseRecipient: "Local organization",
  refurbRecipient: "Repair café / refurbisher",
  recycleRecipient: "Materials recovery",
  disposalRecipient: "Licensed waste handler",
  repairable: true,
  recyclable: true,
  reuseLifeDays: 365,
  refurbLifeDays: 545,
};

const PROFILES: Array<{ match: RegExp; profile: CategoryProfile }> = [
  {
    match: /electronic|computer|phone|laptop|display|e-?waste|appliance/,
    profile: {
      reuseRecipient: "Student / school computer lab",
      refurbRecipient: "Certified refurbisher",
      recycleRecipient: "Certified e-waste recycler",
      disposalRecipient: "Hazardous-waste handler",
      repairable: true,
      recyclable: true,
      reuseLifeDays: 730,
      refurbLifeDays: 900,
    },
  },
  {
    match: /education|book|stationer|school|toy/,
    profile: {
      reuseRecipient: "School / library",
      refurbRecipient: "Rebinding / repair volunteer",
      recycleRecipient: "Paper recycler",
      disposalRecipient: "General waste",
      repairable: false,
      recyclable: true,
      reuseLifeDays: 1095,
      refurbLifeDays: 730,
    },
  },
  {
    match: /clothing|apparel|textile|bedding|accessor/,
    profile: {
      reuseRecipient: "Local shelter",
      refurbRecipient: "Mending / upcycling workshop",
      recycleRecipient: "Textile recycler",
      disposalRecipient: "Licensed waste handler",
      repairable: true,
      recyclable: true,
      reuseLifeDays: 545,
      refurbLifeDays: 545,
    },
  },
  {
    match: /furniture|seating|table|sleep|storage/,
    profile: {
      reuseRecipient: "Shelter / community space",
      refurbRecipient: "Furniture refurbisher",
      recycleRecipient: "Wood & metal recovery",
      disposalRecipient: "Bulky-waste service",
      repairable: true,
      recyclable: true,
      reuseLifeDays: 1460,
      refurbLifeDays: 1825,
    },
  },
  {
    match: /kitchen|home|decor|utensil|cookware/,
    profile: {
      reuseRecipient: "Community kitchen",
      refurbRecipient: "Repair café",
      recycleRecipient: "Materials recovery",
      disposalRecipient: "General waste",
      repairable: false,
      recyclable: true,
      reuseLifeDays: 730,
      refurbLifeDays: 365,
    },
  },
  {
    match: /mobility|bike|bicycle|travel/,
    profile: {
      reuseRecipient: "Direct reuse — commuter / student",
      refurbRecipient: "Cycle refurbisher",
      recycleRecipient: "Metal recovery",
      disposalRecipient: "Licensed waste handler",
      repairable: true,
      recyclable: true,
      reuseLifeDays: 1095,
      refurbLifeDays: 1460,
    },
  },
];

/**
 * Objects whose *identity* — not their condition — rules out ordinary reuse.
 *
 * Two kinds are distinguished because they end in different places:
 *
 *   hazardous  — the material itself is dangerous to hand to a member of the
 *                public. It goes to a handler licensed for it.
 *   unsuitable — safe enough, but no reuse or donation network will take it
 *                (hygiene, safety recalls, or regulation). Materials recovery
 *                is the highest honest outcome.
 *
 * Patterns are matched against category, subcategory and item type together.
 * Word boundaries matter here: "oil" must not fire on "oil painting", and
 * "gas" must not fire on "gas stove", so those read as whole words or with the
 * qualifier that makes them hazardous.
 */
const HAZARD_RULES: Array<{
  match: RegExp;
  kind: HazardFinding["kind"];
  klass: string;
  reason: string;
  ceiling: HazardFinding["ceiling"];
  /** Recipient that overrides the category profile for this class. */
  recycleRecipient?: string;
  disposalRecipient?: string;
}> = [
  {
    match: /\b(battery|batteries|power ?bank|li-?ion|lithium|lead[- ]acid|car battery|inverter battery)\b/,
    kind: "hazardous",
    klass: "battery",
    reason:
      "Batteries can vent, leak or ignite, so they are never passed on for household reuse.",
    ceiling: "recycling",
    recycleRecipient: "Authorised battery / scrap recycler",
    disposalRecipient: "Hazardous-waste handler",
  },
  {
    match: /\b(paint|thinner|solvent|varnish|turpentine|adhesive|glue drum|acid|alkali|bleach|ammonia|chemical|pesticide|insecticide|herbicide|fertili[sz]er|cleaning agent)\b/,
    kind: "hazardous",
    klass: "chemical",
    reason: "Chemical contents must go to a handler licensed to receive them.",
    ceiling: "responsible_disposal",
    recycleRecipient: "Licensed chemical recovery",
    disposalRecipient: "Licensed hazardous-waste handler",
  },
  {
    match: /\b(aerosol|spray can|butane|propane|lpg|gas cylinder|gas canister|cylinder|fuel|petrol|diesel|kerosene|motor oil|engine oil|lubricant|fire ?extinguisher|firework|flare|ammunition)\b/,
    kind: "hazardous",
    klass: "pressurised or flammable",
    reason:
      "Pressurised and flammable containers are unsafe to transport casually or to hand over.",
    ceiling: "responsible_disposal",
    recycleRecipient: "Licensed metal recovery (de-gassed)",
    disposalRecipient: "Licensed hazardous-waste handler",
  },
  {
    match: /\b(syringe|needle|sharps|scalpel|medical waste|biohazard|blood|used mask|catheter|dressing)\b/,
    kind: "hazardous",
    klass: "clinical",
    reason: "Clinical waste can only be taken by a licensed clinical-waste service.",
    ceiling: "responsible_disposal",
    disposalRecipient: "Licensed clinical-waste service",
  },
  {
    match: /\b(medicine|medication|tablet|pill|drug|pharmaceutical|vaccine|inhaler)\b/,
    kind: "hazardous",
    klass: "pharmaceutical",
    reason:
      "Medicines cannot be redistributed; a pharmacy take-back scheme is the correct route.",
    ceiling: "responsible_disposal",
    disposalRecipient: "Pharmacy take-back scheme",
  },
  {
    match: /\b(mercury|thermometer|asbestos|fluorescent tube|cfl|smoke detector|radioactive|toner|ink cartridge)\b/,
    kind: "hazardous",
    klass: "regulated material",
    reason:
      "This contains a regulated material, so it has to go through a handler equipped for it.",
    ceiling: "recycling",
    recycleRecipient: "Certified hazardous-material recycler",
    disposalRecipient: "Hazardous-waste handler",
  },
  {
    match: /\b(knife|blade|machete|sword|gun|pistol|rifle|weapon|taser|pepper spray)\b/,
    kind: "hazardous",
    klass: "weapon or blade",
    reason: "Bladed and weapon-class items are not routed to donation recipients.",
    ceiling: "recycling",
    recycleRecipient: "Licensed scrap-metal merchant",
    disposalRecipient: "Police / licensed disposal",
  },
  {
    match: /\b(underwear|undergarment|innerwear|lingerie|socks|used nappy|diaper|sanitary|toothbrush|razor|comb|hairbrush)\b/,
    kind: "unsuitable",
    klass: "personal hygiene",
    reason: "Hygiene items are not accepted for reuse by donation recipients.",
    ceiling: "recycling",
    recycleRecipient: "Textile / materials recovery",
  },
  {
    match: /\b(car seat|child seat|helmet|cot|crib|smoke alarm|airbag|seat ?belt)\b/,
    kind: "unsuitable",
    klass: "safety-critical",
    reason:
      "Safety-critical items expire and cannot be certified second-hand, so reuse is not offered.",
    ceiling: "recycling",
    recycleRecipient: "Materials recovery",
  },
  {
    match: /\b(food|perishable|opened|expired|leftover|milk|meat|produce)\b/,
    kind: "unsuitable",
    klass: "perishable",
    reason: "Perishable goods cannot be routed through ReHome's reuse network.",
    ceiling: "responsible_disposal",
    disposalRecipient: "Composting / general waste",
  },
];

/**
 * Identify an item that cannot be reused whatever its condition. Returns null
 * for everything else — the reuse-first default is only overridden on an
 * explicit match, never on a guess.
 */
function hazardRuleFor(input: DestinationInput) {
  const haystack = `${norm(input.category)} ${norm(input.subCategory)} ${norm(input.itemType)}`;
  return HAZARD_RULES.find((r) => r.match.test(haystack)) ?? null;
}

function profileFor(input: DestinationInput): CategoryProfile {
  const haystack = `${norm(input.category)} ${norm(input.subCategory)} ${norm(input.itemType)}`;
  return PROFILES.find((p) => p.match.test(haystack))?.profile ?? DEFAULT_PROFILE;
}

/** Viability of each tier given how functional the item is. */
const REUSE_VIABILITY: Record<ConditionBand, number> = {
  working: 92, worn: 70, unknown: 66, minor_issue: 34, not_working: 5, unrepairable: 2, unsafe: 0,
};
const REFURB_VIABILITY: Record<ConditionBand, number> = {
  working: 24, worn: 46, unknown: 40, minor_issue: 88, not_working: 70, unrepairable: 6, unsafe: 12,
};
const RECYCLE_VIABILITY: Record<ConditionBand, number> = {
  working: 8, worn: 30, unknown: 18, minor_issue: 28, not_working: 82, unrepairable: 90, unsafe: 46,
};
const DISPOSAL_VIABILITY: Record<ConditionBand, number> = {
  working: 2, worn: 4, unknown: 4, minor_issue: 6, not_working: 22, unrepairable: 30, unsafe: 88,
};

/** A tier at or above this is considered genuinely realistic, not a fallback. */
const VIABLE = 50;

const REUSE_LIFE_FACTOR: Record<ConditionBand, number> = {
  working: 1, worn: 0.6, unknown: 0.75, minor_issue: 0.4, not_working: 0, unrepairable: 0, unsafe: 0,
};

function rationaleFor(tier: DestinationTier, band: ConditionBand, p: CategoryProfile): string {
  if (tier === "direct_reuse") {
    switch (band) {
      case "working": return "Functional as-is — someone can use this today, with no processing in between.";
      case "worn": return "Worn but serviceable; still usable without repair.";
      case "unknown": return "Assumed usable until a check says otherwise — reuse is the default, not the exception.";
      case "minor_issue": return "A fault stands in the way; reuse only after it is fixed.";
      case "not_working": return "Not functional, so direct reuse would pass on a problem.";
      case "unrepairable": return "Beyond repair — passing it on would just move the problem.";
      case "unsafe": return "Unsafe to pass to another person.";
    }
  }
  if (tier === "refurbishment") {
    if (!p.repairable) return "Refurbishment is not a normal pathway for this kind of item.";
    switch (band) {
      case "minor_issue": return "A fixable fault — repair restores full use and keeps it out of the waste stream.";
      case "not_working": return "May be economically repairable; worth assessing before recovering materials.";
      case "unrepairable": return "Already assessed as beyond economic repair.";
      case "worn": return "Could be restored, though it is usable as-is.";
      case "unknown": return "An option if a check finds a fault.";
      case "working": return "Nothing to repair — refurbishment would add cost without adding life.";
      case "unsafe": return "Repair is only appropriate if the hazard can be fully resolved.";
    }
  }
  if (tier === "recycling") {
    if (!p.recyclable) return "No established recycling stream for this item.";
    switch (band) {
      case "unrepairable": return "Beyond repair — recovering the materials is the highest-value outcome left.";
      case "not_working": return "An option if repair proves uneconomic; check refurbishment first.";
      case "unsafe": return "Materials may be recoverable through a certified handler.";
      case "working":
      case "worn":
      case "minor_issue":
      case "unknown": return "Available, but recycling this now would destroy remaining useful life.";
    }
  }
  switch (band) {
    case "unsafe": return "Hazardous — must go to a handler equipped to take it safely.";
    case "unrepairable":
    case "not_working": return "Last resort if no recycling stream will accept it.";
    default: return "Not appropriate while the item still has usable life.";
  }
}

export function assessDestination(input: DestinationInput): DestinationAssessment {
  const band = conditionBandOf(input.condition);
  const base = profileFor(input);
  const rule = hazardRuleFor(input);
  const hazard: HazardFinding | null = rule
    ? { kind: rule.kind, klass: rule.klass, reason: rule.reason, ceiling: rule.ceiling }
    : null;

  // A hazardous or unsuitable item is routed by what it *is*, not by how well
  // it works. Reuse and refurbishment are removed as destinations entirely, and
  // the recipients become handlers equipped for that class of material.
  const p: CategoryProfile = rule
    ? {
        ...base,
        repairable: false,
        recyclable: rule.ceiling === "recycling" && base.recyclable,
        recycleRecipient: rule.recycleRecipient ?? base.recycleRecipient,
        disposalRecipient: rule.disposalRecipient ?? base.disposalRecipient,
        reuseLifeDays: 0,
        refurbLifeDays: 0,
      }
    : base;

  const options: DestinationOption[] = [
    {
      tier: "direct_reuse",
      label: TIER_LABEL.direct_reuse,
      recipient: p.reuseRecipient,
      viability: hazard ? 0 : REUSE_VIABILITY[band],
      rationale: hazard ? hazard.reason : rationaleFor("direct_reuse", band, p),
      usefulLifeExtensionDays: hazard ? 0 : Math.round(p.reuseLifeDays * REUSE_LIFE_FACTOR[band]),
      available: !hazard,
    },
    {
      tier: "refurbishment",
      label: TIER_LABEL.refurbishment,
      recipient: p.refurbRecipient,
      viability: p.repairable ? REFURB_VIABILITY[band] : 0,
      rationale: hazard
        ? `Repair does not change what this is — ${hazard.klass} items stay out of the reuse network.`
        : rationaleFor("refurbishment", band, p),
      usefulLifeExtensionDays: p.repairable ? p.refurbLifeDays : 0,
      available: p.repairable,
    },
    {
      tier: "recycling",
      label: TIER_LABEL.recycling,
      recipient: p.recycleRecipient,
      viability: p.recyclable ? (hazard ? 88 : RECYCLE_VIABILITY[band]) : 0,
      rationale: p.recyclable && hazard
        ? "Materials can still be recovered, through a handler equipped for this class of item."
        : rationaleFor("recycling", band, p),
      usefulLifeExtensionDays: 0,
      available: p.recyclable,
    },
    {
      tier: "responsible_disposal",
      label: TIER_LABEL.responsible_disposal,
      recipient: p.disposalRecipient,
      viability: hazard ? (p.recyclable ? 60 : 92) : DISPOSAL_VIABILITY[band],
      rationale: hazard
        ? "Handled by a service licensed to take it. Do not attempt disposal yourself."
        : rationaleFor("responsible_disposal", band, p),
      usefulLifeExtensionDays: 0,
      available: true,
    },
  ];

  // Reuse-first selection: take the earliest tier in the ladder that is
  // genuinely viable, rather than the highest-scoring one. Only when nothing
  // clears the bar do we fall back to the most viable option available.
  const primary =
    options.find((o) => o.available && o.viability >= VIABLE) ??
    [...options].sort((a, b) => b.viability - a.viability)[0];

  const ladder = [...options].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );

  return {
    primary,
    ladder,
    conditionBand: band,
    // A hazardous item's condition changes nothing about where it goes, so we
    // do not ask the donor to confirm it.
    needsConditionCheck: band === "unknown" && !hazard,
    hazard,
    summary: summarise(primary, band, input, hazard),
  };
}

function summarise(
  primary: DestinationOption,
  band: ConditionBand,
  input: DestinationInput,
  hazard: HazardFinding | null
): string {
  const what = input.itemType || "This item";

  if (hazard) {
    return primary.tier === "recycling"
      ? `${what} is not suitable for reuse or donation. ${hazard.reason} ReHome routes it to ${primary.recipient.toLowerCase()} instead.`
      : `${what} is not suitable for reuse or donation. ${hazard.reason} It needs ${primary.recipient.toLowerCase()}.`;
  }

  switch (primary.tier) {
    case "direct_reuse":
      return band === "unknown"
        ? `${what} looks reusable. Confirm the condition and it can go straight to ${primary.recipient.toLowerCase()}.`
        : `${what} can be used as-is — ${primary.recipient.toLowerCase()} is the highest-value next destination.`;
    case "refurbishment":
      return `${what} is worth repairing. Refurbishment keeps it in use instead of ending its life early.`;
    case "recycling":
      return `${what} cannot realistically be reused, so recovering its materials is the best remaining outcome.`;
    case "responsible_disposal":
      return `${what} cannot be reused or recycled safely and needs a handler equipped to take it.`;
  }
}

/** Convenience for callers that only need the stored destination label. */
export function destinationPathFor(input: DestinationInput): string {
  return assessDestination(input).primary.label;
}
