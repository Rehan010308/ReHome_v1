import type { AIClassificationResult } from "./types";

export type IntelligenceSource = "vision-baseline" | "rehome-ai" | "mock";

export interface ItemIntelligence extends AIClassificationResult {
  source: IntelligenceSource;
  destinationPath: string;
  whoMightNeed: string;
  lowConfidence: boolean;
  detectedLabel: string | null;
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

function destinationFor(category: string, itemType: string): { path: string; who: string; reuse: string; score: number } {
  const t = itemType.toLowerCase();
  if (t.includes("broken") || t.includes("waste")) {
    return { path: "Recycling", who: "Certified recycler", reuse: "Materials recovery", score: 25 };
  }
  if (t.includes("laptop") || t.includes("phone") || t.includes("computer")) {
    return { path: "Refurbishment", who: "Student / refurbisher", reuse: "High if repairable", score: 72 };
  }
  if (category === "Education" || t.includes("book") || t.includes("backpack")) {
    return { path: "Direct reuse / donation", who: "School / student", reuse: "High", score: 88 };
  }
  if (category === "Clothing") {
    return { path: "Direct reuse / donation", who: "Local shelter", reuse: "High", score: 80 };
  }
  if (category === "Furniture") {
    return { path: "Direct reuse / donation", who: "Shelter / community space", reuse: "High", score: 75 };
  }
  return { path: "Direct reuse / donation", who: "Local organization", reuse: "Moderate", score: 60 };
}

export function intelligenceFromLabel(label: string, confidence01: number): ItemIntelligence {
  const mapped = COCO_MAP[label.toLowerCase()] ?? {
    category: "Household",
    subCategory: "General",
    itemType: label.replace(/\b\w/g, (c) => c.toUpperCase()),
    potentialUse: "Local reuse if condition allows",
  };
  const dest = destinationFor(mapped.category ?? "Household", mapped.itemType ?? label);
  const confidence = Math.round(Math.min(1, Math.max(0, confidence01)) * 100);
  return {
    category: mapped.category ?? "Household",
    subCategory: mapped.subCategory ?? "General",
    itemType: mapped.itemType ?? label,
    condition: "Unknown — confirm after visual check",
    reusability: dest.reuse,
    potentialUse: mapped.potentialUse ?? dest.who,
    confidence,
    source: "vision-baseline",
    destinationPath: dest.path,
    whoMightNeed: dest.who,
    lowConfidence: confidence < 55,
    detectedLabel: label,
  };
}

export async function detectWithCocoSsd(file: File | Blob): Promise<ItemIntelligence> {
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
