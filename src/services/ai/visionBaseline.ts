import type { AIClassificationResult } from "./types";
import { assessDestination, type DestinationAssessment } from "@/services/destination/engine";

export type IntelligenceSource = "vision-baseline" | "rehome-ai" | "mock" | "unavailable";

export interface ItemIntelligence extends AIClassificationResult {
  source: IntelligenceSource;
  destinationPath: string;
  whoMightNeed: string;
  lowConfidence: boolean;
  detectedLabel: string | null;
  /** Full reuse-first ladder, so the UI can show what was ruled out and why. */
  destination: DestinationAssessment;
}

const COCO_MAP: Record<string, Partial<ItemIntelligence>> = {
  backpack: { category: "Education", subCategory: "Bags", itemType: "Backpack", potentialUse: "School / student" },
  handbag: { category: "Clothing", subCategory: "Accessories", itemType: "Bag", potentialUse: "Direct reuse" },
  suitcase: { category: "Home", subCategory: "Travel", itemType: "Suitcase", potentialUse: "Shelter / travel kit" },
  book: { category: "Education", subCategory: "Books", itemType: "Book", potentialUse: "School / library" },
  laptop: { category: "Electronics", subCategory: "Computers", itemType: "Laptop", potentialUse: "Student / refurbisher" },
  keyboard: { category: "Electronics", subCategory: "Computers", itemType: "Keyboard", potentialUse: "School lab / refurbisher" },
  mouse: { category: "Electronics", subCategory: "Computers", itemType: "Computer mouse", potentialUse: "School lab" },
  "cell phone": { category: "Electronics", subCategory: "Phones", itemType: "Mobile phone", potentialUse: "Refurbisher / recycler" },
  tv: { category: "Electronics", subCategory: "Displays", itemType: "Television", potentialUse: "Community space / recycler" },
  remote: { category: "Electronics", subCategory: "Accessories", itemType: "Remote control", potentialUse: "Reuse with matching device" },
  bottle: { category: "Home", subCategory: "Kitchen", itemType: "Bottle", potentialUse: "Kitchen / shelter" },
  cup: { category: "Home", subCategory: "Kitchen", itemType: "Cup", potentialUse: "Community kitchen" },
  bowl: { category: "Home", subCategory: "Kitchen", itemType: "Bowl", potentialUse: "Community kitchen" },
  chair: { category: "Furniture", subCategory: "Seating", itemType: "Chair", potentialUse: "School / office reuse" },
  couch: { category: "Furniture", subCategory: "Seating", itemType: "Sofa", potentialUse: "Shelter / household reuse" },
  bed: { category: "Furniture", subCategory: "Sleep", itemType: "Bed", potentialUse: "Shelter" },
  "dining table": { category: "Furniture", subCategory: "Tables", itemType: "Table", potentialUse: "Community / household" },
  bicycle: { category: "Mobility", subCategory: "Bikes", itemType: "Bicycle", potentialUse: "Direct reuse" },
  umbrella: { category: "Clothing", subCategory: "Accessories", itemType: "Umbrella", potentialUse: "Direct reuse" },
  tie: { category: "Clothing", subCategory: "Apparel", itemType: "Clothing", potentialUse: "Direct reuse" },
  "teddy bear": { category: "Education", subCategory: "Toys", itemType: "Toy", potentialUse: "Children's home" },
  clock: { category: "Home", subCategory: "Decor", itemType: "Clock", potentialUse: "Direct reuse" },
  vase: { category: "Home", subCategory: "Decor", itemType: "Vase", potentialUse: "Direct reuse" },
  scissors: { category: "Education", subCategory: "Stationery", itemType: "Scissors", potentialUse: "School" },
};

/**
 * Reusability label derived from the destination ladder rather than guessed
 * from the category. The wording matters: reusabilityScoreFromLabel() in the
 * matching engine reads "high" / "moderate" / "material" out of this string.
 */
export function reusabilityLabelFor(assessment: DestinationAssessment): string {
  const { tier, viability } = assessment.primary;
  if (tier === "direct_reuse") return viability >= 70 ? "High" : "Moderate — confirm condition";
  if (tier === "refurbishment") return "High if repaired";
  if (tier === "recycling") return "Materials recovery";
  return "None — safe handling required";
}

const UNKNOWN_CONDITION = "Unknown — confirm after visual check";

export function intelligenceFromLabel(label: string, confidence01: number): ItemIntelligence {
  const mapped = COCO_MAP[label.toLowerCase()] ?? {
    category: "Household",
    subCategory: "General",
    itemType: label.replace(/\b\w/g, (c) => c.toUpperCase()),
    potentialUse: "Local reuse if condition allows",
  };
  const category = mapped.category ?? "Household";
  const subCategory = mapped.subCategory ?? "General";
  const itemType = mapped.itemType ?? label;

  // Detection tells us what the object is, never whether it works — so the
  // condition stays unknown here and the ladder is recomputed once the user
  // confirms it. Reuse-first means unknown is treated as reusable, not broken.
  const destination = assessDestination({ category, subCategory, itemType, condition: UNKNOWN_CONDITION });
  const confidence = Math.round(Math.min(1, Math.max(0, confidence01)) * 100);

  return {
    category,
    subCategory,
    itemType,
    condition: UNKNOWN_CONDITION,
    reusability: reusabilityLabelFor(destination),
    potentialUse: mapped.potentialUse ?? destination.primary.recipient,
    confidence,
    source: "vision-baseline",
    destinationPath: destination.primary.label,
    whoMightNeed: destination.primary.recipient,
    lowConfidence: confidence < 55,
    detectedLabel: label,
    destination,
  };
}

/**
 * The detector is not local code: COCO-SSD pulls its weights from
 * storage.googleapis.com in five shards. On a slow or filtered connection those
 * requests never settle, and an unbounded await leaves the scan sitting on
 * "Identifying object" forever with nothing actually happening. We would rather
 * admit the detector is unavailable and let the person describe the item.
 */
export const DETECTOR_TIMEOUT_MS = 20_000;

export class DetectorUnavailableError extends Error {
  constructor(message = "The on-device detector could not load.") {
    super(message);
    this.name = "DetectorUnavailableError";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DetectorUnavailableError()), ms);
    void work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (cause) => { clearTimeout(timer); reject(cause); }
    );
  });
}

/**
 * What we return when detection genuinely did not run. Nothing is invented:
 * the identity fields stay empty so the interface asks the question instead of
 * asserting an answer it does not have.
 */
export function detectionUnavailable(): ItemIntelligence {
  const destination = assessDestination({
    category: "",
    subCategory: "",
    itemType: "",
    condition: UNKNOWN_CONDITION,
  });
  return {
    category: "",
    subCategory: "",
    itemType: "",
    condition: UNKNOWN_CONDITION,
    reusability: reusabilityLabelFor(destination),
    potentialUse: destination.primary.recipient,
    confidence: 0,
    source: "unavailable",
    destinationPath: destination.primary.label,
    whoMightNeed: destination.primary.recipient,
    lowConfidence: true,
    detectedLabel: null,
    destination,
  };
}

export function detectWithCocoSsd(file: File | Blob): Promise<ItemIntelligence> {
  return withTimeout(runCocoSsd(file), DETECTOR_TIMEOUT_MS);
}

async function runCocoSsd(file: File | Blob): Promise<ItemIntelligence> {
  const [{ load }, tf] = await Promise.all([
    import("@tensorflow-models/coco-ssd"),
    import("@tensorflow/tfjs"),
  ]);
  await tf.ready();
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read this image.");
  ctx.drawImage(bitmap, 0, 0);
  const model = await load({ base: "lite_mobilenet_v2" });
  const predictions = await model.detect(canvas);
  bitmap.close();

  const top = predictions.sort((a, b) => b.score - a.score)[0];
  if (!top) {
    return intelligenceFromLabel("household item", 0.35);
  }
  return intelligenceFromLabel(top.class, top.score);
}

export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
