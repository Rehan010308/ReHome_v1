import type { AIClassificationResult, ClassifyImageInput } from "./types";

/**
 * MOCK classifier — PLACEHOLDER ONLY.
 *
 * This simulates the real AI so the full pipeline
 * (image → structured result → UI → Supabase → matching) can be built and
 * tested now. It returns a realistic-looking, deterministic result.
 *
 * Swap this out in Phase 8 when the real model is provided.
 * This is NOT the final AI and must never be presented as such.
 */
export async function mockClassifyImage(
  _input: ClassifyImageInput
): Promise<AIClassificationResult> {
  // Simulated model latency so loading states are exercised for real.
  await new Promise((resolve) => setTimeout(resolve, 900));

  return {
    category: "Education",
    subCategory: "Books",
    itemType: "Mathematics Textbook",
    condition: "Good",
    reusability: "High",
    potentialUse: "School / Student",
    confidence: 91,
  };
}