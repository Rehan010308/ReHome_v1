import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, Loader2, MapPin, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { analyzeItem, type ItemIntelligence } from "@/services/ai";
import { createItem, uploadItemImage } from "@/lib/data/catalog";
import { persistMatchesForItem } from "@/lib/data/matches";
import { reusabilityScoreFromLabel } from "@/services/matching/engine";
import { assessDestination } from "@/services/destination/engine";
import { blurCoordinates, requestPosition, type Coordinates } from "@/services/geo";
import { DestinationLadder } from "@/components/system/DestinationLadder";
import { GlowButton } from "@/components/system/primitives";

type Step = "capture" | "analyzing" | "identify" | "condition" | "details" | "review";

/**
 * Condition is a choice, not free text. The destination engine parses condition
 * into functional bands, and typed prose ("bit knackered") made that a guess.
 * These options map onto the bands unambiguously.
 */
const CONDITIONS = [
  { value: "Excellent", hint: "As new, barely used" },
  { value: "Good", hint: "Works, light wear" },
  { value: "Fair", hint: "Works, visibly worn" },
  { value: "Repairable — minor issue", hint: "One fixable fault" },
  { value: "Not working", hint: "Faulty, repair not assessed" },
  { value: "Beyond repair", hint: "Not economically repairable" },
  { value: "Unsafe / hazardous", hint: "Damaged battery, leaking, unsafe" },
] as const;

const StepDots = ({ current }: { current: number }) => (
  <div className="flex items-center gap-1.5" aria-hidden>
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className={`h-1 rounded-full transition-all duration-500 ${
          i < current ? "w-6 bg-white/30" : i === current ? "w-10 bg-lime-300" : "w-6 bg-white/10"
        }`}
      />
    ))}
  </div>
);

const Choice = ({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-[16px] border px-5 py-4 text-left transition-colors ${
      selected
        ? "border-lime-300/50 bg-lime-300/10"
        : "border-white/10 bg-white/[0.02] hover:border-white/25"
    }`}
  >
    <p className={`text-sm font-semibold ${selected ? "text-lime-100" : "text-white/85"}`}>{title}</p>
    {hint ? <p className="mt-0.5 text-xs text-white/40">{hint}</p> : null}
  </button>
);

/**
 * One flow, two ways in. Manual entry skips capture and detection but keeps
 * every later step, so an item typed in by hand still gets condition
 * assessment, quantity, location and a destination ladder — it is the same
 * intelligent path, not a lesser CRUD form.
 */
export default function ScanItem({ mode = "scan" }: { mode?: "scan" | "manual" }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const manual = mode === "manual";

  const [step, setStep] = useState<Step>(manual ? "identify" : "capture");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ItemIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [identity, setIdentity] = useState({ category: "", subCategory: "", itemType: "" });
  const [correcting, setCorrecting] = useState(manual);
  const [corrected, setCorrected] = useState(manual);
  const [condition, setCondition] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const destination = useMemo(
    () =>
      assessDestination({
        category: identity.category,
        subCategory: identity.subCategory,
        itemType: identity.itemType,
        condition: condition || "Unknown",
      }),
    [identity, condition]
  );

  const runAnalysis = async (next: File) => {
    setFile(next);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(next); });
    setError(null);
    setStep("analyzing");
    try {
      const intelligence = await analyzeItem(next);
      setResult(intelligence);
      setIdentity({
        category: intelligence.category,
        subCategory: intelligence.subCategory,
        itemType: intelligence.itemType,
      });
      setStep("identify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not analyse that image.");
      setStep("capture");
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      // Stored at ~1 km precision. Distance stays useful; the donor's address
      // never leaves the device.
      const exact = await requestPosition();
      setCoords(blurCoordinates(exact, "area"));
      setLocationNote("Added at approximate precision — never your exact address.");
    } catch (cause) {
      setLocationNote(cause instanceof Error ? cause.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const onConfirm = async () => {
    if (!profile) return;
    if (!manual && (!file || !result)) return;
    setSaving(true);
    setError(null);
    try {
      const imagePath = file ? await uploadItemImage(profile.userId, file) : null;
      const item = await createItem({
        owner_id: profile.userId,
        category: identity.category.trim(),
        subcategory: identity.subCategory.trim(),
        item_type: identity.itemType.trim(),
        condition,
        reusability: destination.primary.tier === "direct_reuse" ? "High" : destination.primary.tier === "refurbishment" ? "High if repaired" : "Materials recovery",
        reusability_score: reusabilityScoreFromLabel(
          destination.primary.tier === "direct_reuse" ? "High" : destination.primary.tier,
          result?.confidence ?? 70
        ),
        potential_use: destination.primary.recipient,
        destination_path: destination.primary.label,
        image_path: imagePath,
        location: profile.location ?? undefined,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        confidence: result?.confidence,
        notes: result?.detectedLabel ? `Detected as ${result.detectedLabel}` : undefined,
        quantity,
        ai_source: corrected ? "manual" : result?.source,
        user_corrected: corrected,
      });
      await persistMatchesForItem(item);
      navigate("/app/matches");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = { capture: 0, analyzing: 0, identify: 1, condition: 2, details: 2, review: 3 }[step];

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
      <StepDots current={stepIndex} />

      {error ? (
        <p className="mt-6 rounded-[16px] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {/* ── 1. Capture ──────────────────────────────────────────────── */}
      {step === "capture" ? (
        <div className="mt-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight">
            Show us the item
          </h1>
          <p className="mt-3 leading-relaxed text-white/55">
            One photo is enough. Everything else, ReHome works out.
          </p>

          <label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center transition-colors hover:border-lime-300/40 hover:bg-white/[0.04]">
            <Camera className="h-7 w-7 text-lime-300" />
            <span className="mt-4 font-display text-lg">Take or choose a photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void runAnalysis(f); }}
            />
          </label>
        </div>
      ) : null}

      {/* ── 2. Analysing ────────────────────────────────────────────── */}
      {step === "analyzing" ? (
        <div className="mt-8 flex flex-col items-center py-20 text-center">
          {preview ? (
            <img src={preview} alt="" className="mb-8 max-h-48 rounded-[18px] object-contain opacity-60" />
          ) : null}
          <Loader2 className="h-6 w-6 animate-spin text-lime-300" />
          <p className="mt-5 text-sm tracking-[0.2em] uppercase text-white/45">Reading the object</p>
        </div>
      ) : null}

      {/* ── 3. Identify — one question, confirm or correct ──────────── */}
      {step === "identify" && (result || manual) ? (
        <div className="mt-8">
          {manual ? (
            <>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                What are you rehoming?
              </h1>
              <p className="mt-3 leading-relaxed text-white/55">
                Describe it in your own words. ReHome handles the rest the same way.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-lime-300/80">What we found</p>

              {preview ? (
                <img src={preview} alt="" className="mt-6 max-h-40 rounded-[18px] object-contain" />
              ) : null}

              <h1 className="mt-6 font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                {identity.itemType}
              </h1>
              <p className="mt-2 text-white/50">
                {identity.category}
                {result && result.lowConfidence
                  ? " — low confidence"
                  : result && result.confidence >= 80
                    ? " — high confidence"
                    : " — moderate confidence"}
              </p>
            </>
          )}

          {!correcting ? (
            <>
              <p className="mt-8 text-lg text-white/75">Is that right?</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <GlowButton onClick={() => setStep("condition")} className="sm:flex-1">
                  <Check className="h-4 w-4" />
                  Yes, that's it
                </GlowButton>
                <GlowButton variant="ghost" onClick={() => setCorrecting(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Not quite
                </GlowButton>
              </div>
            </>
          ) : (
            <div className="mt-8 space-y-4">
              {([["itemType", "What is it"], ["category", "Category"], ["subCategory", "Subcategory"]] as const).map(
                ([key, label]) => (
                  <label key={key} className="block space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
                    <input
                      className="rh-input"
                      value={identity[key]}
                      onChange={(e) => setIdentity((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </label>
                )
              )}
              <GlowButton
                onClick={() => { setCorrected(true); setCorrecting(false); setStep("condition"); }}
                disabled={!identity.itemType.trim() || !identity.category.trim()}
              >
                {manual ? "Continue" : "Save correction"}
              </GlowButton>
            </div>
          )}
        </div>
      ) : null}

      {/* ── 4. Condition ────────────────────────────────────────────── */}
      {step === "condition" ? (
        <div className="mt-8">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
            What condition is it in?
          </h1>
          <p className="mt-3 leading-relaxed text-white/55">
            This decides where it can go. A working item goes straight to someone who needs it.
          </p>

          <div className="mt-7 space-y-2.5">
            {CONDITIONS.map((c) => (
              <Choice
                key={c.value}
                title={c.value}
                hint={c.hint}
                selected={condition === c.value}
                onClick={() => { setCondition(c.value); setStep("details"); }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── 5. Quantity + location ──────────────────────────────────── */}
      {step === "details" ? (
        <div className="mt-8">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
            How many, and roughly where?
          </h1>
          <p className="mt-3 leading-relaxed text-white/55">
            Quantity lets your donation count properly toward what organizations actually need.
          </p>

          <div className="mt-8 flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.02] px-5 py-4">
            <span className="text-sm text-white/60">How many</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="One fewer"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-9 w-9 rounded-full border border-white/12 text-white/70 hover:bg-white/5"
              >−</button>
              <span className="w-8 text-center font-display text-xl font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="One more"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-9 w-9 rounded-full border border-white/12 text-white/70 hover:bg-white/5"
              >+</button>
            </div>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={`mt-3 flex w-full items-center justify-between rounded-[18px] border px-5 py-4 text-left transition-colors ${
              coords ? "border-lime-300/40 bg-lime-300/8" : "border-white/10 bg-white/[0.02] hover:border-white/25"
            }`}
          >
            <span className="flex items-center gap-2.5 text-sm">
              <MapPin className={`h-4 w-4 ${coords ? "text-lime-300" : "text-white/50"}`} />
              {coords ? "Location added" : locating ? "Locating…" : "Use my location"}
            </span>
            <span className="text-xs text-white/35">{coords ? "Change" : "Optional"}</span>
          </button>
          {locationNote ? <p className="mt-2 text-xs text-white/40">{locationNote}</p> : null}
          {!coords ? (
            <p className="mt-2 text-xs text-white/30">
              Without a location we can still match you — just not by distance.
            </p>
          ) : null}

          <GlowButton className="mt-8 w-full" onClick={() => setStep("review")}>
            Continue
          </GlowButton>
        </div>
      ) : null}

      {/* ── 6. Review ───────────────────────────────────────────────── */}
      {step === "review" && (result || manual) ? (
        <div className="mt-8">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
            Where this should go
          </h1>

          <div className="mt-7">
            <DestinationLadder assessment={destination} />
          </div>

          <dl className="mt-6 space-y-3 rounded-[18px] border border-white/8 bg-white/[0.02] p-5 text-sm">
            {[
              ["Item", `${identity.itemType}${quantity > 1 ? ` ×${quantity}` : ""}`],
              ["Category", identity.category],
              ["Condition", condition],
              ["Location", coords ? "Approximate area shared" : "Not shared"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-white/35">{k}</dt>
                <dd className="text-right text-white/80">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <GlowButton onClick={onConfirm} disabled={saving} className="sm:flex-1">
              {saving ? "Finding destinations…" : "Add to ReHome"}
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => setStep("condition")} disabled={saving}>
              Back
            </GlowButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
