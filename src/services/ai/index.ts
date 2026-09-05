import { mockClassifyImage } from "./mockClassifier";
import type { AIClassificationResult, ClassifyImageInput } from "./types";

export type { AIClassificationResult, ClassifyImageInput };

/**
 * AI service seam — the ONLY import point for classification across the app.
 *
 * Phase 8: replace `mockClassifyImage` with the real model (or a call to the
 * `classify-image` edge function) here and nothing else changes.
 */
export const classifyImage = mockClassifyImage;