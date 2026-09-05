/**
 * Structured output expected from the ReHome AI classification layer.
 * The real model (Phase 8) must return exactly this shape so the rest of
 * the app never changes when the model is swapped in.
 */
export interface AIClassificationResult {
  category: string;
  subCategory: string;
  itemType: string;
  condition: string;
  reusability: string;
  potentialUse: string;
  /** 0–100 */
  confidence: number;
}

/** Input the classifier accepts: a camera capture, uploaded file, or URL string. */
export type ClassifyImageInput = File | Blob | string;