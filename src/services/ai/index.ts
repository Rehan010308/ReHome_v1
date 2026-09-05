import { supabase } from "@/lib/supabase";
import { mockClassifyImage } from "./mockClassifier";
import type { AIClassificationResult, ClassifyImageInput } from "./types";
import {
  detectWithCocoSsd,
  fileToDataUrl,
  intelligenceFromLabel,
  type ItemIntelligence,
} from "./visionBaseline";

export type { AIClassificationResult, ClassifyImageInput, ItemIntelligence };

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
    return {
      ...mock,
      source: "mock",
      destinationPath: "Direct reuse / donation",
      whoMightNeed: mock.potentialUse,
      lowConfidence: mock.confidence < 55,
      detectedLabel: mock.itemType,
    };
  }

  let baseline: ItemIntelligence;
  try {
    baseline = await detectWithCocoSsd(input);
  } catch {
    baseline = intelligenceFromLabel("household item", 0.4);
  }

  if (!supabase) return baseline;

  try {
    const image = await fileToDataUrl(input);
    const { data, error } = await supabase.functions.invoke("analyze-item", {
      body: {
        image,
        visionHint: {
          category: baseline.category,
          itemType: baseline.itemType,
          detectedLabel: baseline.detectedLabel,
          confidence: baseline.confidence,
        },
      },
    });
    if (error || !data) return baseline;
    const parsed = data as Partial<ItemIntelligence>;
    if (!parsed.category || !parsed.itemType) return baseline;
    return {
      category: String(parsed.category),
      subCategory: String(parsed.subCategory ?? baseline.subCategory),
      itemType: String(parsed.itemType),
      condition: String(parsed.condition ?? baseline.condition),
      reusability: String(parsed.reusability ?? baseline.reusability),
      potentialUse: String(parsed.potentialUse ?? baseline.potentialUse),
      confidence: Number(parsed.confidence ?? baseline.confidence),
      source: "rehome-ai",
      destinationPath: String(parsed.destinationPath ?? baseline.destinationPath),
      whoMightNeed: String(parsed.whoMightNeed ?? baseline.whoMightNeed),
      lowConfidence: Number(parsed.confidence ?? baseline.confidence) < 55,
      detectedLabel: baseline.detectedLabel,
    };
  } catch {
    return baseline;
  }
}

/** Landing demo seam — same contract as before. */
export const classifyImage = analyzeItem;
