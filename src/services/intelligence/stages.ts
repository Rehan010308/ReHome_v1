/**
 * The seven beats of a ReHome analysis.
 *
 * These are not decoration. Each stage names work that genuinely happens —
 * the image arriving, the detector running, the condition being read, the
 * destination ladder being scored, open demand being searched, a destination
 * being chosen — and the interface only advances when that step has actually
 * completed. A stage that cannot be truthfully claimed is never shown.
 */

export type IntelligenceStage =
  | "idle"
  | "image_received"
  | "identifying"
  | "assessing_condition"
  | "reuse_potential"
  | "searching_demand"
  | "calculating_destination"
  | "destination_found"
  | "failed";

/** Ordered, excluding idle and failed — those are states, not beats. */
export const STAGE_SEQUENCE: IntelligenceStage[] = [
  "image_received",
  "identifying",
  "assessing_condition",
  "reuse_potential",
  "searching_demand",
  "calculating_destination",
  "destination_found",
];

export const STAGE_LABEL: Record<IntelligenceStage, string> = {
  idle: "Standing by",
  image_received: "Image received",
  identifying: "Identifying object",
  assessing_condition: "Assessing condition",
  reuse_potential: "Understanding reuse potential",
  searching_demand: "Searching demand",
  calculating_destination: "Calculating destination",
  destination_found: "Destination found",
  failed: "Could not read this image",
};

export function stageIndex(stage: IntelligenceStage): number {
  const i = STAGE_SEQUENCE.indexOf(stage);
  return i < 0 ? -1 : i;
}

export function isActive(stage: IntelligenceStage): boolean {
  return stage !== "idle" && stage !== "failed";
}

/**
 * Values the surface reveals as they become known. Every field is optional
 * because the surface shows a reading only once it exists — an empty slot is
 * honest, a placeholder is not.
 */
export interface IntelligenceTelemetry {
  object?: string | null;
  /** 0–100, from the detector. Null when nothing has been detected yet. */
  confidence?: number | null;
  condition?: string | null;
  /** Destination tier label, e.g. "Direct reuse / donation". */
  reuse?: string | null;
  /** How many open requirements were scored, once the search has run. */
  demandScanned?: number | null;
  destination?: string | null;
  distanceKm?: number | null;
  hazard?: boolean;
}
