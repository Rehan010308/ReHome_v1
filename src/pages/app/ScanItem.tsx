import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";
import { GlowButton, StatusBadge } from "@/components/system/primitives";
import { useAuth } from "@/context/AuthContext";
import { analyzeItem, type ItemIntelligence } from "@/services/ai";
import { createItem, uploadItemImage } from "@/lib/data/catalog";
import { persistMatchesForItem as saveMatches } from "@/lib/data/matches";
import { reusabilityScoreFromLabel } from "@/services/matching/engine";

const story = ["Object", "Scanning", "Understanding", "Structuring", "Matching", "Destination"] as const;

export default function ScanItem() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ItemIntelligence | null>(null);
  const [form, setForm] = useState({
    category: "",
    subCategory: "",
    itemType: "",
    condition: "",
    reusability: "",
    potentialUse: "",
    location: profile?.location ?? "",
  });

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const runAnalysis = async (nextFile: File) => {
    setFile(nextFile);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(nextFile);
    });
    setBusy(true);
    setError(null);
    setResult(null);
    setStage(1);
    try {
      setStage(2);
      const intelligence = await analyzeItem(nextFile);
      setStage(3);
      setResult(intelligence);
      setForm({
        category: intelligence.category,
        subCategory: intelligence.subCategory,
        itemType: intelligence.itemType,
        condition: intelligence.condition,
        reusability: intelligence.reusability,
        potentialUse: intelligence.potentialUse,
        location: profile?.location ?? "",
      });
      setStage(5);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !file || !result) return;
    setSaving(true);
    setError(null);
    try {
      const imagePath = await uploadItemImage(profile.userId, file);
      const corrected =
        form.category !== result.category ||
        form.subCategory !== result.subCategory ||
        form.itemType !== result.itemType ||
        form.condition !== result.condition;
      const item = await createItem({
        owner_id: profile.userId,
        category: form.category.trim(),
        subcategory: form.subCategory.trim(),
        item_type: form.itemType.trim(),
        condition: form.condition.trim(),
        reusability: form.reusability.trim(),
        reusability_score: reusabilityScoreFromLabel(form.reusability, result.confidence),
        potential_use: form.potentialUse.trim(),
        destination_path: result.destinationPath,
        image_path: imagePath,
        location: form.location.trim(),
        confidence: result.confidence,
        notes: result.detectedLabel ? `Detected as ${result.detectedLabel}` : undefined,
        quantity: 1,
        ai_source: result.source,
        user_corrected: corrected,
      });
      await saveMatches(item);
      navigate("/app/matches");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Item intake</StatusBadge>
      <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Scan an item</h1>
      <p className="mt-3 text-white/55 leading-relaxed">
        Capture unused objects. Baseline computer vision proposes a structured profile. You confirm it,
        then ReHome stores it and scores destinations.
      </p>

      <label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center hover:border-lime-300/30 hover:bg-white/[0.05] transition-colors">
        {preview ? (
          <img src={preview} alt="Selected item" className="max-h-56 rounded-2xl object-contain" />
        ) : (
          <Camera className="h-8 w-8 text-lime-300" />
        )}
        <span className="mt-4 font-display text-lg">{preview ? "Replace photo" : "Drop a photo or choose a file"}</span>
        <span className="mt-2 text-sm text-white/40">COCO-SSD baseline runs in the browser. Optional cloud AI stays server-side.</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) void runAnalysis(next);
          }}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-2">
        {story.map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
              i <= stage ? "bg-lime-300/15 text-lime-200" : "bg-white/5 text-white/30"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {busy ? <p className="mt-6 text-sm text-white/50">Reading the object…</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {result ? (
        <form onSubmit={onSave} className="mt-8 rh-card rounded-[22px] p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
            <span>{result.source === "rehome-ai" ? "ReHome AI" : result.source === "mock" ? "Demo classifier" : "Vision baseline"}</span>
            <span>·</span>
            <span>{result.confidence}% confidence</span>
            {result.lowConfidence ? <span className="text-amber-200">Low confidence — please correct</span> : null}
          </div>
          <p className="text-sm text-white/55">
            Who might need this: <span className="text-lime-200">{result.whoMightNeed}</span>
          </p>
          {(
            [
              ["category", "Category"],
              ["subCategory", "Subcategory"],
              ["itemType", "Item type"],
              ["condition", "Condition"],
              ["reusability", "Reusability"],
              ["potentialUse", "Potential use"],
              ["location", "Location"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
              <input
                className="rh-input"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                required
              />
            </label>
          ))}
          <GlowButton type="submit" disabled={saving}>
            {saving ? "Saving and matching…" : "Add to ReHome"}
          </GlowButton>
        </form>
      ) : null}
    </div>
  );
}
