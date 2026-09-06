import { supabase } from "@/lib/supabase";
import { assessDestination } from "@/services/destination/engine";
import { mockClassifyImage } from "./mockClassifier";
import type { AIClassificationResult, ClassifyImageInput } from "./types";
import {
  detectionUnavailable,
  DetectorUnavailableError,
  detectWithCocoSsd,
  fileToDataUrl,
  reusabilityLabelFor,
  type ItemIntelligence,
} from "./visionBaseline";

export type { AIClassificationResult, ClassifyImageInput, ItemIntelligence };

/**
 * The server model is optional, so it is never allowed to hold the flow open.
 * If `analyze-item` is not deployed the call still has to travel and fail, and
 * a person waiting on a photo should not pay for that indefinitely.
 */
const SERVER_MODEL_TIMEOUT_MS = 8_000;

/**
 * Set once the Edge Function has failed in this page session — most often
 * because it is simply not deployed. Someone clearing a room scans several
 * things in a row, and there is no reason to make every one of them wait on a
 * call we already know does not answer.
 */
let serverModelUnreachable = false;

/**
 * Same idea for the detector, which fetches several megabytes of weights.
 * Someone clearing a room scans one thing after another, and once that download
 * has already run out its clock there is nothing to gain from making every
 * later item wait the full timeout again. A page reload gives it a fresh start.
 */
let detectorUnreachable = false;

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    void work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (cause) => { clearTimeout(timer); reject(cause); }
    );
  });
}

function isFileLike(input: ClassifyImageInput): input is File | Blob {
  return typeof input !== "string";
}

/**
 * Provider-independent intelligence entry.
 * 1) COCO-SSD baseline in the browser
 * 2) Optional server-side model via Edge Function `analyze-item` (OpenRouter / Claude)
 * 3) String inputs still use the mock so the landing demo keeps working
 */
export async function analyzeItem(input: ClassifyImageInput): Promise<ItemIntelligence> {
  if (!isFileLike(input)) {
    const mock = await mockClassifyImage(input);
    // The landing demo renders this result verbatim, so the mock's own fields
    // are passed through untouched; only the destination ladder is attached.
    return {
      ...mock,
      source: "mock",
      destinationPath: assessDestination(mock).primary.label,
      whoMightNeed: mock.potentialUse,
      lowConfidence: mock.confidence < 55,
      detectedLabel: mock.itemType,
      destination: assessDestination(mock),
    };
  }

  // A failed detection is not a detection of "household item". When the
  // detector cannot run we hold nothing, say so, and let the person describe
  // the object themselves — a guess dressed as a reading is worse than none.
  let baseline: ItemIntelligence | null = null;
  if (!detectorUnreachable) {
    try {
      baseline = await detectWithCocoSsd(input);
    } catch (cause) {
      // A timed-out load says the weights are not coming; a failure on one
      // image says nothing about the next one, so only the former sticks.
      if (cause instanceof DetectorUnavailableError) detectorUnreachable = true;
      baseline = null;
    }
  }

  if (!supabase || serverModelUnreachable) return baseline ?? detectionUnavailable();

  try {
    const image = await fileToDataUrl(input);
    const { data, error } = await withDeadline(
      supabase.functions.invoke("analyze-item", {
        body: {
          image,
          // Only a real reading is offered as a hint; there is nothing to pass
          // on when the detector never ran.
          visionHint: baseline
            ? {
                category: baseline.category,
                itemType: baseline.itemType,
                detectedLabel: baseline.detectedLabel,
                confidence: baseline.confidence,
              }
            : null,
        },
      }),
      SERVER_MODEL_TIMEOUT_MS
    );
    if (error || !data) {
      serverModelUnreachable = true;
      return baseline ?? detectionUnavailable();
    }
    const parsed = data as Partial<ItemIntelligence>;
    if (!parsed.category || !parsed.itemType) return baseline ?? detectionUnavailable();

    const category = String(parsed.category);
    const subCategory = String(parsed.subCategory ?? baseline?.subCategory ?? "");
    const itemType = String(parsed.itemType);
    const condition = String(parsed.condition ?? baseline?.condition ?? "");

    // The destination ladder is recomputed locally from whatever the model
    // reported, rather than trusting a free-text destination back from it —
    // reuse-first ordering is a ReHome rule, not something a provider decides.
    const destination = assessDestination({ category, subCategory, itemType, condition });

    return {
      category,
      subCategory,
      itemType,
      condition,
      reusability: String(parsed.reusability ?? baseline?.reusability ?? reusabilityLabelFor(destination)),
      potentialUse: String(parsed.potentialUse ?? baseline?.potentialUse ?? destination.primary.recipient),
      confidence: Number(parsed.confidence ?? baseline?.confidence ?? 0),
      source: "rehome-ai",
      destinationPath: destination.primary.label,
      whoMightNeed: String(parsed.whoMightNeed ?? destination.primary.recipient),
      lowConfidence: Number(parsed.confidence ?? baseline?.confidence ?? 0) < 55,
      detectedLabel: baseline?.detectedLabel ?? null,
      destination,
    };
  } catch {
    serverModelUnreachable = true;
    return baseline ?? detectionUnavailable();
  }
}

/** Landing demo seam — same contract as before. */
export const classifyImage = analyzeItem;
