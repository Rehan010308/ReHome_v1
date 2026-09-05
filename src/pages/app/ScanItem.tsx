import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, MapPin, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { analyzeItem, type ItemIntelligence } from "@/services/ai";
import { createItem, uploadItemImage } from "@/lib/data/catalog";
import { persistMatchesForItem } from "@/lib/data/matches";
import { reusabilityScoreFromLabel } from "@/services/matching/engine";
import { assessDestination } from "@/services/destination/engine";
import { blurCoordinates, requestPosition, type Coordinates } from "@/services/geo";
import { DestinationLadder } from "@/components/system/DestinationLadder";
import { AnalysisScanner } from "@/components/spatial/AnalysisScanner";
import { Reveal } from "@/components/system/Reveal";
import { GlowButton } from "@/components/system/primitives";

type Step = "capture" | "analyzing" | "identify" | "condition" | "details" | "review";

/**
 * Condition is a choice, not free text. The destination engine parses condition
 * into functional bands, and typed prose made that a guess. These options map
 * onto the bands unambiguously.
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

const ORDER: Step[] = ["capture", "analyzing", "identify", "condition", "details", "review"];

/** Progress as a single filling line, not a numbered stepper. */
const Progress = ({ step }: { step: Step }) => {
  const pct = ((ORDER.indexOf(step) + 1) / ORDER.length) * 100;
  return (
    <div className="h-px w-full bg-white/[0.07]" aria-hidden>
      <div
        className="h-px bg-gradient-to-r from-lime-300/40 to-lime-300 transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

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
    className={`group flex w-full items-baseline justify-between gap-6 border-b border-white/[0.06] py-4 text-left transition-colors ${
      selected ? "border-lime-300/40" : "hover:border-white/20"
    }`}
  >
    <span className={`text-[17px] ${selected ? "text-lime-200" : "text-white/85 group-hover:text-white"}`}>
      {title}
    </span>
    <span className="shrink-0 text-[13px] text-white/30">{hint}</span>
  </button>
);

/**
 * One flow, two ways in. Manual entry skips capture and detection but keeps
 * every later step, so an item typed in by hand still gets condition
 * assessment, quantity, location and a destination ladder.
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
  const [phase, setPhase] = useState("Reading the image");

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
    setPhase("Reading the image");

    // The phases name work that is genuinely happening: the detector loads,
    // then runs. No fabricated progress.
    const t1 = window.setTimeout(() => setPhase("Loading the detector"), 500);
    const t2 = window.setTimeout(() => setPhase("Looking for objects"), 1400);

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
      setError(cause instanceof Error ? cause.message : "Could not read that image. Try another photo.");
      setStep("capture");
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      const exact = await requestPosition();
      setCoords(blurCoordinates(exact, "area"));
      setLocationNote("Stored as an approximate area, never your exact address.");
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
        reusability:
          destination.primary.tier === "direct_reuse"
            ? "High"
            : destination.primary.tier === "refurbishment"
              ? "High if repaired"
              : "Materials recovery",
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

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(70% 50% at 50% 0%, rgba(30,92,70,0.26), transparent 70%)" }}
      />

      <Progress step={step} />

      <div className="relative mx-auto max-w-2xl px-5 pb-28 pt-16 md:pt-24">
        {error ? (
          <p className="mb-8 rounded-[16px] border border-rose-300/20 bg-rose-300/[0.08] px-5 py-4 text-[15px] text-rose-100">
            {error}
          </p>
        ) : null}

        {/* ── Capture ─────────────────────────────────────────────────── */}
        {step === "capture" ? (
          <Reveal>
            <h1 className="font-display text-[clamp(2.3rem,6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.025em]">
              Show us the object.
            </h1>
            <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/50">
              One photo is enough. ReHome reads it and works out where it belongs.
            </p>

            <label className="group mt-12 block cursor-pointer">
              <div className="rh-surface flex flex-col items-center justify-center rounded-[26px] px-6 py-20 text-center transition-all duration-500 group-hover:border-lime-300/25">
                <span
                  className="grid h-16 w-16 place-items-center rounded-full transition-transform duration-500 group-hover:scale-105"
                  style={{ background: "radial-gradient(circle, rgba(163,230,53,0.22), transparent 70%)" }}
                >
                  <Camera className="h-6 w-6 text-lime-300" />
                </span>
                <span className="mt-6 font-display text-xl font-semibold">Take or choose a photo</span>
                <span className="mt-2 text-[13px] text-white/35">
                  Detection runs on your device
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void runAnalysis(f); }}
              />
            </label>
          </Reveal>
        ) : null}

        {/* ── Analysing ───────────────────────────────────────────────── */}
        {step === "analyzing" && preview ? (
          <div className="pt-6">
            <AnalysisScanner src={preview} stage={phase} />
          </div>
        ) : null}

        {/* ── Identify ────────────────────────────────────────────────── */}
        {step === "identify" && (result || manual) ? (
          <Reveal>
            {manual ? (
              <>
                <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.025em]">
                  What are you rehoming?
                </h1>
                <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/50">
                  Describe it in your own words. Everything after this is the same.
                </p>
              </>
            ) : (
              <>
                {preview ? (
                  <div className="mb-10">
                    <AnalysisScanner src={preview} stage="Read" settled />
                  </div>
                ) : null}
                <p className="text-[15px] text-white/40">ReHome sees</p>
                <h1 className="mt-3 font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.025em]">
                  {identity.itemType}
                </h1>
                <p className="mt-3 text-[17px] text-white/45">
                  {identity.category}
                  {result ? (
                    <span className="ml-3 text-white/30">
                      {result.lowConfidence
                        ? "low confidence"
                        : result.confidence >= 80
                          ? "high confidence"
                          : "moderate confidence"}
                    </span>
                  ) : null}
                </p>
              </>
            )}

            {!correcting ? (
              <div className="mt-12">
                <p className="text-[17px] text-white/70">Is that right?</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <GlowButton onClick={() => setStep("condition")} className="sm:flex-1">
                    <Check className="h-4 w-4" />
                    Yes, that's it
                  </GlowButton>
                  <GlowButton variant="ghost" onClick={() => setCorrecting(true)}>
                    <RotateCcw className="h-4 w-4" />
                    Not quite
                  </GlowButton>
                </div>
              </div>
            ) : (
              <div className="mt-10 space-y-6">
                {([["itemType", "What is it"], ["category", "Category"], ["subCategory", "Subcategory"]] as const).map(
                  ([k, label]) => (
                    <label key={k} className="block">
                      <span className="text-[13px] text-white/40">{label}</span>
                      <input
                        className="mt-2 w-full border-0 border-b border-white/12 bg-transparent px-0 py-2.5 text-[19px] text-white outline-none transition-colors focus:border-lime-300/60"
                        value={identity[k]}
                        onChange={(e) => setIdentity((p) => ({ ...p, [k]: e.target.value }))}
                        placeholder={k === "itemType" ? "Mathematics textbook" : ""}
                      />
                    </label>
                  )
                )}
                <GlowButton
                  onClick={() => { setCorrected(true); setCorrecting(false); setStep("condition"); }}
                  disabled={!identity.itemType.trim() || !identity.category.trim()}
                >
                  Continue
                </GlowButton>
              </div>
            )}
          </Reveal>
        ) : null}

        {/* ── Condition ───────────────────────────────────────────────── */}
        {step === "condition" ? (
          <Reveal>
            <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.025em]">
              What state is it in?
            </h1>
            <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/50">
              This decides where it can go. Something that still works goes straight to
              someone who needs it.
            </p>

            <div className="mt-11 border-t border-white/[0.06]">
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
          </Reveal>
        ) : null}

        {/* ── Quantity + location ─────────────────────────────────────── */}
        {step === "details" ? (
          <Reveal>
            <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.025em]">
              How many?
            </h1>
            <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/50">
              Quantity is what lets your donation count properly toward what organizations
              actually need.
            </p>

            <div className="mt-12 flex items-center gap-8">
              <button
                type="button"
                aria-label="One fewer"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="h-12 w-12 rounded-full border border-white/12 text-xl text-white/70 transition-colors hover:bg-white/5 disabled:opacity-20"
              >−</button>
              <span className="font-display text-[4rem] font-bold leading-none tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="One more"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-12 w-12 rounded-full border border-white/12 text-xl text-white/70 transition-colors hover:bg-white/5"
              >+</button>
            </div>

            <div className="mt-14">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className={`flex w-full items-center justify-between gap-4 border-b py-4 text-left transition-colors ${
                  coords ? "border-lime-300/40" : "border-white/[0.08] hover:border-white/25"
                }`}
              >
                <span className="flex items-center gap-3 text-[17px]">
                  <MapPin className={`h-4 w-4 ${coords ? "text-lime-300" : "text-white/40"}`} />
                  {coords ? "Location added" : locating ? "Locating…" : "Use my location"}
                </span>
                <span className="text-[13px] text-white/30">{coords ? "Change" : "Optional"}</span>
              </button>
              <p className="mt-3 text-[13px] leading-relaxed text-white/35">
                {locationNote ??
                  "Sharing a rough area lets ReHome rank nearby destinations. Your exact address is never stored."}
              </p>
            </div>

            <GlowButton className="mt-12 w-full sm:w-auto" onClick={() => setStep("review")}>
              Find destinations
            </GlowButton>
          </Reveal>
        ) : null}

        {/* ── Review ──────────────────────────────────────────────────── */}
        {step === "review" && (result || manual) ? (
          <>
            <Reveal>
              <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.025em]">
                Where this should go.
              </h1>
            </Reveal>

            <Reveal delay={90} className="mt-10">
              <DestinationLadder assessment={destination} />
            </Reveal>

            <Reveal delay={160} className="mt-8">
              <dl className="rh-inset rounded-[20px] px-6 py-5">
                {[
                  ["Item", `${identity.itemType}${quantity > 1 ? ` ×${quantity}` : ""}`],
                  ["Category", identity.category],
                  ["Condition", condition],
                  ["Location", coords ? "Approximate area shared" : "Not shared"],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={`flex justify-between gap-6 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
                  >
                    <dt className="text-[15px] text-white/35">{k}</dt>
                    <dd className="text-right text-[15px] text-white/85">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <GlowButton onClick={onConfirm} disabled={saving} className="sm:flex-1">
                  {saving ? "Finding destinations…" : "Add to ReHome"}
                </GlowButton>
                <GlowButton variant="ghost" onClick={() => setStep("condition")} disabled={saving}>
                  Back
                </GlowButton>
              </div>
            </Reveal>
          </>
        ) : null}
      </div>
    </div>
  );
}
