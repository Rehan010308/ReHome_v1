import { useEffect, useMemo, useRef, useState } from "react";
import {
  STAGE_LABEL,
  STAGE_SEQUENCE,
  isActive,
  stageIndex,
  type IntelligenceStage,
  type IntelligenceTelemetry,
} from "@/services/intelligence/stages";

/**
 * The ReHome Intelligence surface.
 *
 * The pre-login pages already carry the cinematic 3D language, so this is
 * deliberately its own thing: a flat, instrument-grade panel — the readout of a
 * machine that is working, not a second stage set. Everything on it is driven
 * by real state. The beam only sweeps while an analysis is genuinely running,
 * a field only fills once its value exists, and the stage rail advances when
 * the corresponding work has actually completed.
 *
 * Idle is a first-class state, not an absence: a slow light field, one long
 * scan pass, a dot matrix and a little grain. It should read as "powered on and
 * waiting", never as "loading".
 */

const FIELDS = [
  { key: "object", label: "Object", stage: "identifying" },
  { key: "condition", label: "Condition", stage: "assessing_condition" },
  { key: "reuse", label: "Reuse path", stage: "reuse_potential" },
  { key: "demand", label: "Demand", stage: "searching_demand" },
  { key: "destination", label: "Destination", stage: "calculating_destination" },
] as const;

function fieldValue(
  key: (typeof FIELDS)[number]["key"],
  t: IntelligenceTelemetry
): string | null {
  switch (key) {
    case "object":
      return t.object ?? null;
    case "condition":
      return t.condition ?? null;
    case "reuse":
      return t.reuse ?? null;
    case "demand":
      return t.demandScanned === null || t.demandScanned === undefined
        ? null
        : `${t.demandScanned} open ${t.demandScanned === 1 ? "requirement" : "requirements"} scored`;
    case "destination":
      return t.destination ?? null;
  }
}

/** Characters resolve left to right, the way a value settles rather than blinks. */
const Resolving = ({ text, active }: { text: string; active: boolean }) => {
  const [shown, setShown] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) {
      setShown(text.length);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= text.length) window.clearInterval(timer);
    }, 26);
    return () => window.clearInterval(timer);
  }, [text, active]);

  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length ? <span className="rh-caret" aria-hidden /> : null}
    </>
  );
};

export function IntelligenceSurface({
  stage,
  telemetry,
  /** Optional still of what is being read, shown inside the frame. */
  imageSrc,
  className = "",
}: {
  stage: IntelligenceStage;
  telemetry: IntelligenceTelemetry;
  imageSrc?: string | null;
  className?: string;
}) {
  const active = isActive(stage);
  const index = stageIndex(stage);
  const settled = stage === "destination_found";
  const failed = stage === "failed";

  // Remembers which fields have already resolved, so a value only animates in
  // the first time it appears and stays put afterwards.
  const seen = useRef<Set<string>>(new Set());
  const rows = useMemo(
    () =>
      FIELDS.map((field) => {
        const value = fieldValue(field.key, telemetry);
        const firstTime = value !== null && !seen.current.has(field.key);
        if (value !== null) seen.current.add(field.key);
        return { ...field, value, firstTime };
      }),
    [telemetry]
  );

  useEffect(() => {
    if (stage === "idle") seen.current.clear();
  }, [stage]);

  const state = failed ? "failed" : settled ? "settled" : active ? "reading" : "idle";

  return (
    <section
      className={`rh-surface-panel relative overflow-hidden ${className}`}
      data-state={state}
      aria-label="ReHome Intelligence"
    >
      {/* Light field — one soft source, drifting. */}
      <span className="rh-lightfield" aria-hidden />
      {/* Instrument matrix. */}
      <span className="rh-matrix" aria-hidden />
      {/* Grain, so the black is a material and not a void. */}
      <svg className="rh-grain" aria-hidden focusable="false">
        <filter id="rh-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#rh-grain-filter)" />
      </svg>
      {/* The beam. Sweeps slowly at rest, briskly while reading. */}
      <span className="rh-beam" aria-hidden />

      <div className="relative grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10 md:p-9">
        {/* ── Left: what the system is doing ─────────────────────────── */}
        <div className="min-w-0">
          <p className="rh-mono text-[10px] tracking-[0.34em] text-lime-200/70">
            REHOME INTELLIGENCE
          </p>

          <p className="mt-4 font-display text-[clamp(1.35rem,3vw,1.85rem)] font-semibold leading-tight tracking-[-0.02em]">
            {failed ? (
              <span className="text-rose-200">{STAGE_LABEL.failed}</span>
            ) : settled ? (
              <span className="text-lime-100">Destination found</span>
            ) : active ? (
              STAGE_LABEL[stage]
            ) : (
              <span className="text-white/45">Standing by</span>
            )}
          </p>

          <p className="mt-2.5 max-w-xs text-[13px] leading-relaxed text-white/35">
            {failed
              ? "Nothing was read from that image. Try another photo."
              : settled
                ? "Scored against open demand and ranked reuse-first."
                : active
                  ? "Reading the object, then working out where it creates the most value next."
                  : "Scan an object and this surface will show what ReHome is doing with it."}
          </p>

          {/* Stage rail — ticks and type, not a row of pills. */}
          <ol className="mt-7 space-y-[7px]">
            {STAGE_SEQUENCE.map((s, i) => {
              const done = index > i;
              const now = index === i;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`rh-tick ${now ? "is-now" : done ? "is-done" : ""}`}
                    aria-hidden
                  />
                  <span
                    className={`rh-mono text-[10px] tracking-[0.18em] transition-colors duration-500 ${
                      now
                        ? "text-lime-200"
                        : done
                          ? "text-white/45"
                          : "text-white/[0.18]"
                    }`}
                  >
                    {STAGE_LABEL[s].toUpperCase()}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* ── Right: what it has actually found ──────────────────────── */}
        <div className="min-w-0">
          <div className="rh-readout relative overflow-hidden rounded-[16px]">
            {imageSrc ? (
              <div className="relative h-[104px] w-full overflow-hidden border-b border-white/[0.06]">
                <img
                  src={imageSrc}
                  alt=""
                  className={`h-full w-full object-cover transition-all duration-1000 ${
                    settled ? "opacity-70 saturate-100" : "opacity-45 saturate-[0.35]"
                  }`}
                />
                <span className="rh-readout-scan" aria-hidden />
                {/* Lock-on brackets close once the reading settles. */}
                {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                  <span key={corner} className={`rh-bracket rh-bracket-${corner}`} aria-hidden />
                ))}
              </div>
            ) : null}

            <dl className="divide-y divide-white/[0.05]">
              {rows.map((row) => {
                const pending = row.value === null;
                return (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-5 px-4 py-[11px]"
                  >
                    <dt className="rh-mono shrink-0 text-[9.5px] tracking-[0.2em] text-white/25">
                      {row.label.toUpperCase()}
                    </dt>
                    <dd
                      className={`min-w-0 break-words text-right text-[13.5px] leading-snug ${
                        pending
                          ? "text-white/[0.14]"
                          : row.key === "destination"
                            ? "text-lime-100"
                            : "text-white/80"
                      }`}
                    >
                      {pending ? (
                        <span className="rh-mono tracking-[0.2em]">— — —</span>
                      ) : (
                        <Resolving text={row.value ?? ""} active={row.firstTime} />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {/* Confidence and hazard are qualifiers on the reading, so they sit
                under it rather than pretending to be findings of their own. */}
            {telemetry.confidence != null || telemetry.hazard ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.05] px-4 py-2.5">
                {telemetry.confidence != null ? (
                  <span className="rh-mono text-[9.5px] tracking-[0.18em] text-white/30">
                    CONFIDENCE {Math.round(telemetry.confidence)}%
                  </span>
                ) : null}
                {telemetry.hazard ? (
                  <span className="rh-mono text-[9.5px] tracking-[0.18em] text-amber-200/85">
                    REUSE CLOSED — RECOVERY ROUTE
                  </span>
                ) : null}
                {telemetry.distanceKm != null ? (
                  <span className="rh-mono text-[9.5px] tracking-[0.18em] text-white/30">
                    {telemetry.distanceKm < 10
                      ? telemetry.distanceKm.toFixed(1)
                      : Math.round(telemetry.distanceKm)}{" "}
                    KM
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
