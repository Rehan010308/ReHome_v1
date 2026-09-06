import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, ImagePlus, MapPin, Plus, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRehomingSession } from "@/context/SessionContext";
import { analyzeItem, type ItemIntelligence } from "@/services/ai";
import { createItem, uploadItemImage } from "@/lib/data/catalog";
import { persistMatchesForItem } from "@/lib/data/matches";
import { reusabilityScoreFromLabel } from "@/services/matching/engine";
import { assessDestination } from "@/services/destination/engine";
import { reusabilityLabelFor } from "@/services/ai/visionBaseline";
import {
  blurCoordinates,
  formatCoordinates,
  requestPosition,
  resolveLocality,
  type Coordinates,
} from "@/services/geo";
import type { IntelligenceStage } from "@/services/intelligence/stages";
import { DestinationLadder } from "@/components/system/DestinationLadder";
import { IntelligenceSurface } from "@/components/system/IntelligenceSurface";
import { CameraCapture } from "@/components/system/CameraCapture";
import { Reveal } from "@/components/system/Reveal";
import { GlowButton } from "@/components/system/primitives";

type Step =
  | "capture"
  | "camera"
  | "analyzing"
  | "identify"
  | "condition"
  | "details"
  | "review"
  | "session";

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
  const known = ORDER.indexOf(step);
  const pct = step === "session" ? 100 : ((Math.max(0, known) + 1) / ORDER.length) * 100;
  return (
    <div className="h-px w-full bg-white/[0.07]" aria-hidden>
      <div
        className="h-px bg-gradient-to-r from-lime-300/40 to-lime-300 transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

/**
 * Removing the photo has to be an obvious, single action — a scan that has
 * attached the wrong image is otherwise a dead end.
 */
const RemoveAttachment = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-[13px] text-white/60 transition-colors hover:border-rose-300/40 hover:text-rose-100"
  >
    <X className="h-3.5 w-3.5" />
    Remove photo
  </button>
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
  const { profile, updateProfileDetails } = useAuth();
  const session = useRehomingSession();
  const navigate = useNavigate();
  const manual = mode === "manual";

  const [step, setStep] = useState<Step>(manual ? "identify" : "capture");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ItemIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Not a failure: something the person needs to know before they continue. */
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<IntelligenceStage>("idle");

  const [identity, setIdentity] = useState({ category: "", subCategory: "", itemType: "" });
  const [correcting, setCorrecting] = useState(manual);
  const [corrected, setCorrected] = useState(manual);
  const [condition, setCondition] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  /**
   * The identify step has two faces: what ReHome read, or a request for the
   * person to describe the object. A detector that could not run puts us in the
   * second one just as surely as entering the flow manually does.
   */
  const describing = manual || result?.source === "unavailable";

  /**
   * A confidence figure belongs to a reading the machine actually made. Once
   * the person has corrected the identity — or supplied it because detection
   * never ran — the old score describes a discarded guess, so nothing is shown
   * rather than a number that means something else.
   */
  const reportedConfidence = corrected ? null : result?.confidence ?? null;

  /** The session row this pass through the flow is writing into. */
  const entryId = useRef<string | null>(null);

  // Location is remembered on the profile, so a donor who shared it once is
  // never asked again — the scan simply starts with what is already known.
  const [coords, setCoords] = useState<Coordinates | null>(
    profile?.latitude != null && profile?.longitude != null
      ? { latitude: profile.latitude, longitude: profile.longitude }
      : null
  );
  const [placeName, setPlaceName] = useState<string | null>(profile?.location ?? null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  /**
   * Identifies the attachment currently being analysed. Detection takes several
   * seconds, so a removal — or a second photo — can land while the first run is
   * still in flight; anything that finishes against a stale id is discarded
   * instead of resurrecting an image the user has already dropped.
   */
  const runId = useRef(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  /** What to show for the location: a real place name, or the real coordinates. */
  const locationLabel = placeName ?? (coords ? formatCoordinates(coords) : null);

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

  /** Push the current reading onto the session row, so the surface can show it. */
  const publish = (next: IntelligenceStage, telemetry: Record<string, unknown> = {}) => {
    setStage(next);
    if (entryId.current) {
      session.update(entryId.current, {
        stage: next,
        telemetry,
        label: identity.itemType || "New item",
      });
    }
  };

  /**
   * Drop the attached image and everything derived from it. The inputs are
   * cleared too: without that, re-picking the same file fires no change event
   * and the user is left staring at a screen that will not move.
   */
  const clearAttachment = () => {
    runId.current += 1;
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setFile(null);
    setResult(null);
    setIdentity({ category: "", subCategory: "", itemType: "" });
    setCorrecting(false);
    setCorrected(false);
    setCondition("");
    setError(null);
    setNotice(null);
    setStage("idle");
    if (entryId.current) {
      session.remove(entryId.current);
      entryId.current = null;
    }
    if (cameraInput.current) cameraInput.current.value = "";
    if (uploadInput.current) uploadInput.current.value = "";
    setStep("capture");
  };

  const runAnalysis = async (next: File) => {
    const run = (runId.current += 1);
    if (!entryId.current) entryId.current = session.begin();

    setFile(next);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(next); });
    setError(null);
    setNotice(null);
    setStep("analyzing");
    publish("image_received");

    // The stages name work that is genuinely happening: the detector loads,
    // then runs. No fabricated progress.
    const t1 = window.setTimeout(() => {
      if (runId.current === run) publish("identifying");
    }, 450);

    try {
      const intelligence = await analyzeItem(next);
      if (runId.current !== run) return;
      setResult(intelligence);

      // Detection did not run — no model, no reading. Open the description
      // fields and say why, rather than presenting an invented identity as
      // something ReHome saw.
      const unread = intelligence.source === "unavailable";
      setNotice(
        unread
          ? "ReHome could not read this photo — the on-device detector did not load. Describe the item and everything after this works the same."
          : null
      );
      if (unread) {
        setCorrecting(true);
        setCorrected(true);
      }
      setIdentity({
        category: intelligence.category,
        subCategory: intelligence.subCategory,
        itemType: intelligence.itemType,
      });
      if (entryId.current) {
        session.update(entryId.current, {
          stage: "identifying",
          label: intelligence.itemType,
          telemetry: {
            object: intelligence.itemType,
            confidence: unread ? null : intelligence.confidence,
          },
        });
      }
      setStage("identifying");
      setStep("identify");
    } catch (cause) {
      if (runId.current !== run) return;
      setError(cause instanceof Error ? cause.message : "Could not read that image. Try another photo.");
      publish("failed");
      setStep("capture");
    } finally {
      window.clearTimeout(t1);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      const area = blurCoordinates(await requestPosition(), "area");
      setCoords(area);

      // Show the place, not a confirmation. If the geocoder cannot answer we
      // fall back to the coordinates we actually hold rather than a placeholder.
      const locality = await resolveLocality(area);
      setPlaceName(locality?.label ?? null);
      setLocationNote(
        locality
          ? "Approximate area only — your exact address is never stored."
          : "Approximate area only. No place name available, so the coordinates are shown."
      );

      // Remembered on the profile so destinations and handoff can use it later.
      try {
        await updateProfileDetails({
          location: locality?.label,
          city: locality?.city ?? undefined,
          region: locality?.region ?? undefined,
          country: locality?.country ?? undefined,
          latitude: area.latitude,
          longitude: area.longitude,
          locationPrecision: "area",
        });
      } catch {
        // Saving is a convenience; this scan still has the location in hand.
      }
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
    if (!entryId.current) entryId.current = session.begin();
    publish("searching_demand", {
      object: identity.itemType,
      confidence: reportedConfidence,
      condition,
      reuse: destination.primary.label,
      hazard: Boolean(destination.hazard),
    });

    try {
      const imagePath = file ? await uploadItemImage(profile.userId, file) : null;
      const item = await createItem({
        owner_id: profile.userId,
        category: identity.category.trim(),
        subcategory: identity.subCategory.trim(),
        item_type: identity.itemType.trim(),
        condition,
        // One source of truth for the reusability wording: the ladder. Spelling
        // it out here previously read "Materials recovery" for responsible
        // disposal too, which claimed a recovery route that does not exist.
        reusability: reusabilityLabelFor(destination),
        reusability_score: reusabilityScoreFromLabel(
          reusabilityLabelFor(destination),
          // A corrected identity carries no machine confidence, so the score
          // falls back to the neutral default instead of inheriting a number
          // that described a different object.
          corrected ? 70 : result?.confidence ?? 70
        ),
        potential_use: destination.primary.recipient,
        destination_path: destination.primary.label,
        image_path: imagePath,
        location: locationLabel ?? profile.location ?? undefined,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        confidence: corrected ? undefined : result?.confidence,
        notes: result?.detectedLabel ? `Detected as ${result.detectedLabel}` : undefined,
        quantity,
        ai_source: corrected ? "manual" : result?.source,
        user_corrected: corrected,
      });

      const matches = await persistMatchesForItem(item);
      const best = matches[0] ?? null;

      if (entryId.current) {
        session.update(entryId.current, {
          stage: "destination_found",
          label: identity.itemType,
          itemId: item.id,
          quantity,
          telemetry: {
            object: identity.itemType,
            confidence: reportedConfidence,
            condition,
            reuse: destination.primary.label,
            demandScanned: matches.length,
            destination: best ? destination.primary.recipient : "No open demand matched yet",
            distanceKm: best?.distance_km ?? null,
            hazard: Boolean(destination.hazard),
          },
        });
      }
      setStage("destination_found");
      setStep("session");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this item.");
      publish("failed");
    } finally {
      setSaving(false);
    }
  };

  /** Start a fresh pass without unwinding the session. */
  const addAnother = () => {
    runId.current += 1;
    entryId.current = null;
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setFile(null);
    setResult(null);
    setIdentity({ category: "", subCategory: "", itemType: "" });
    setCorrecting(manual);
    setCorrected(manual);
    setCondition("");
    setQuantity(1);
    setError(null);
    setStage("idle");
    if (cameraInput.current) cameraInput.current.value = "";
    if (uploadInput.current) uploadInput.current.value = "";
    setStep(manual ? "identify" : "capture");
  };

  const surfaceTelemetry = {
    object: identity.itemType || null,
    confidence: reportedConfidence,
    condition: condition || null,
    reuse: condition ? destination.primary.label : null,
    hazard: Boolean(destination.hazard),
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

        {notice ? (
          <p className="mb-8 rounded-[16px] border border-white/12 bg-white/[0.04] px-5 py-4 text-[15px] text-white/70">
            {notice}
          </p>
        ) : null}

        {/* ── Capture ─────────────────────────────────────────────────── */}
        {step === "capture" ? (
          <Reveal>
            <h1 className="font-display text-[clamp(2.3rem,6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.025em]">
              Point your camera
              <span className="block text-white/40">at something unused.</span>
            </h1>
            <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/50">
              One photo is enough. ReHome reads it and works out where it belongs.
            </p>

            <button
              type="button"
              onClick={() => setStep("camera")}
              className="group mt-12 block w-full text-left"
            >
              <div className="rh-surface flex flex-col items-center justify-center rounded-[26px] px-6 py-20 text-center transition-all duration-500 group-hover:border-lime-300/25">
                <span
                  className="grid h-16 w-16 place-items-center rounded-full transition-transform duration-500 group-hover:scale-105"
                  style={{ background: "radial-gradient(circle, rgba(163,230,53,0.22), transparent 70%)" }}
                >
                  <Camera className="h-6 w-6 text-lime-300" />
                </span>
                <span className="mt-6 font-display text-xl font-semibold">Scan with camera</span>
                <span className="mt-2 text-[13px] text-white/35">
                  Opens your camera. Detection runs on your device.
                </span>
              </div>
            </button>

            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2.5 rounded-full border border-white/12 py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/30 hover:text-white">
              <ImagePlus className="h-4 w-4" />
              Upload photo
              <input
                ref={uploadInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void runAnalysis(f); }}
              />
            </label>

            {/* Kept for phones, where the OS camera app is often the better
                capture experience than an in-page viewfinder. */}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2.5 text-[12px] uppercase tracking-[0.16em] text-white/30 transition-colors hover:text-white/60 md:hidden">
              Use the device camera app instead
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void runAnalysis(f); }}
              />
            </label>

            {session.entries.length > 0 ? (
              <div className="mt-12">
                <SessionList entries={session.entries} />
              </div>
            ) : null}
          </Reveal>
        ) : null}

        {/* ── Live camera ─────────────────────────────────────────────── */}
        {step === "camera" ? (
          <Reveal>
            <h1 className="font-display text-[clamp(1.9rem,5vw,2.8rem)] font-bold leading-[1.04] tracking-[-0.025em]">
              Frame the object.
            </h1>
            <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-white/50">
              Fill the frame with the single object you want to rehome.
            </p>
            <div className="mt-8">
              <CameraCapture
                onCapture={(captured) => void runAnalysis(captured)}
                onClose={() => setStep("capture")}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2.5 text-[12px] uppercase tracking-[0.16em] text-white/35 transition-colors hover:text-white/70">
              <ImagePlus className="h-3.5 w-3.5" />
              Or upload a photo instead
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void runAnalysis(f); }}
              />
            </label>
          </Reveal>
        ) : null}

        {/* ── Analysing ───────────────────────────────────────────────── */}
        {step === "analyzing" ? (
          <div className="pt-2">
            <IntelligenceSurface stage={stage} telemetry={surfaceTelemetry} imageSrc={preview} />
            <div className="mt-6 flex justify-center">
              <RemoveAttachment onClick={clearAttachment} />
            </div>
          </div>
        ) : null}

        {/* ── Identify ────────────────────────────────────────────────── */}
        {step === "identify" && (result || manual) ? (
          <Reveal>
            {describing ? (
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
                    <IntelligenceSurface
                      stage={stage}
                      telemetry={surfaceTelemetry}
                      imageSrc={preview}
                    />
                    <div className="mt-5 flex justify-center">
                      <RemoveAttachment onClick={clearAttachment} />
                    </div>
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
                  <GlowButton
                    onClick={() => { publish("assessing_condition", { object: identity.itemType, confidence: reportedConfidence }); setStep("condition"); }}
                    className="sm:flex-1"
                  >
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
                  onClick={() => {
                    setCorrected(true);
                    setCorrecting(false);
                    publish("assessing_condition", { object: identity.itemType, confidence: null });
                    setStep("condition");
                  }}
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
                  onClick={() => {
                    setCondition(c.value);
                    publish("reuse_potential", {
                      object: identity.itemType,
                      condition: c.value,
                      reuse: assessDestination({
                        category: identity.category,
                        subCategory: identity.subCategory,
                        itemType: identity.itemType,
                        condition: c.value,
                      }).primary.label,
                    });
                    setStep("details");
                  }}
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
                <span className="flex min-w-0 items-center gap-3 text-[17px]">
                  <MapPin className={`h-4 w-4 shrink-0 ${coords ? "text-lime-300" : "text-white/40"}`} />
                  {locationLabel ? (
                    <span className="min-w-0">
                      <span className="block text-[11px] uppercase tracking-[0.22em] text-white/35">
                        Location
                      </span>
                      <span className="block truncate text-lime-100">{locationLabel}</span>
                    </span>
                  ) : (
                    <span>{locating ? "Locating…" : "Use my location"}</span>
                  )}
                </span>
                <span className="shrink-0 text-[13px] text-white/30">
                  {locationLabel ? "Update" : "Optional"}
                </span>
              </button>
              <p className="mt-3 text-[13px] leading-relaxed text-white/35">
                {locationNote ??
                  (locationLabel
                    ? "Used to rank nearby destinations and to estimate the handoff journey."
                    : "Sharing a rough area lets ReHome rank nearby destinations. Your exact address is never stored.")}
              </p>
            </div>

            <GlowButton
              className="mt-12 w-full sm:w-auto"
              onClick={() => {
                publish("calculating_destination", {
                  object: identity.itemType,
                  condition,
                  reuse: destination.primary.label,
                  hazard: Boolean(destination.hazard),
                });
                setStep("review");
              }}
            >
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
                  ["Location", locationLabel ?? "Not shared"],
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

        {/* ── Session ─────────────────────────────────────────────────── */}
        {step === "session" ? (
          <Reveal>
            <IntelligenceSurface
              stage="destination_found"
              telemetry={
                session.entries.find((e) => e.id === entryId.current)?.telemetry ?? surfaceTelemetry
              }
              imageSrc={preview}
            />

            <div className="mt-10">
              <SessionList entries={session.entries} />
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <GlowButton onClick={addAnother} className="sm:flex-1">
                <Plus className="h-4 w-4" />
                Add another item
              </GlowButton>
              <GlowButton variant="ghost" onClick={() => navigate("/app/matches")}>
                Review destinations
              </GlowButton>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-white/30">
              Nothing is committed yet. Open Destinations to accept where each item should go.
            </p>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The session so far. A short ledger of this visit — deliberately not a table,
 * because a person clearing a room wants to see momentum, not a spreadsheet.
 */
function SessionList({
  entries,
}: {
  entries: ReturnType<typeof useRehomingSession>["entries"];
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="rh-mono text-[10px] tracking-[0.3em] text-white/35">REHOMING SESSION</p>
      <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {entries.map((entry, i) => {
          const done = entry.stage === "destination_found";
          const failed = entry.stage === "failed";
          return (
            <li key={entry.id} className="flex items-center gap-4 py-3.5">
              <span className="rh-mono w-6 shrink-0 text-[10px] tabular-nums text-white/20">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-white/85">
                {entry.label}
                {entry.quantity > 1 ? (
                  <span className="ml-2 text-white/35">×{entry.quantity}</span>
                ) : null}
              </span>
              <span
                className={`shrink-0 text-[12.5px] ${
                  done ? "text-lime-200" : failed ? "text-rose-200/80" : "text-white/40"
                }`}
              >
                {done ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Destination found
                  </span>
                ) : failed ? (
                  "Could not read"
                ) : (
                  "Analysing…"
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
