import type { DestinationAssessment, DestinationOption } from "@/services/destination/engine";

const YEAR = 365;

function lifeLabel(days: number): string {
  if (days <= 0) return "No life extension";
  if (days < 60) return `~${days} days of further use`;
  if (days < YEAR) return `~${Math.round(days / 30)} months of further use`;
  const years = days / YEAR;
  return `~${years >= 2 ? Math.round(years) : years.toFixed(1)} years of further use`;
}

const Rung = ({
  option,
  index,
  isPrimary,
  isLast,
}: {
  option: DestinationOption;
  index: number;
  isPrimary: boolean;
  isLast: boolean;
}) => {
  const muted = !option.available || option.viability < 20;

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* Rail */}
      <div className="relative flex flex-col items-center">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold tabular-nums transition-colors ${
            isPrimary
              ? "border-lime-300/60 bg-lime-300/15 text-lime-200 shadow-[0_0_20px_rgba(163,230,53,0.28)]"
              : muted
                ? "border-white/8 text-white/25"
                : "border-white/15 text-white/45"
          }`}
        >
          {index + 1}
        </span>
        {!isLast ? (
          <span
            className={`mt-1 w-px flex-1 ${isPrimary ? "bg-gradient-to-b from-lime-300/40 to-white/8" : "bg-white/8"}`}
          />
        ) : null}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p
            className={`font-display text-sm font-semibold tracking-tight ${
              isPrimary ? "text-lime-200" : muted ? "text-white/35" : "text-white/75"
            }`}
          >
            {option.label}
          </p>
          {isPrimary ? (
            <span className="rounded-full border border-lime-300/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-lime-200/85">
              Highest value
            </span>
          ) : null}
          {!option.available ? (
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">Not applicable</span>
          ) : null}
        </div>

        <p className={`mt-1 text-xs ${muted ? "text-white/25" : "text-white/50"}`}>{option.recipient}</p>
        <p className={`mt-2 text-sm leading-relaxed ${muted ? "text-white/30" : "text-white/60"}`}>
          {option.rationale}
        </p>

        {option.available ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isPrimary ? "bg-gradient-to-r from-lime-300 to-emerald-400" : "bg-white/25"
                }`}
                style={{ width: `${option.viability}%` }}
              />
            </div>
            <span
              className={`w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums ${
                isPrimary ? "text-lime-200" : "text-white/30"
              }`}
            >
              {option.viability}%
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
};

export const DestinationLadder = ({ assessment }: { assessment: DestinationAssessment }) => (
  <section className="rh-card rounded-[22px] p-6 md:p-7" aria-label="Reuse-first destination assessment">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="inline-flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-lime-200/80">
        <span className="h-px w-6 bg-lime-300/40" />
        Reuse-first routing
      </p>
      {assessment.needsConditionCheck ? (
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
          Confirm condition
        </span>
      ) : null}
    </div>

    <p className="mt-4 font-display text-lg leading-snug text-white">{assessment.summary}</p>

    <ol className="mt-7">
      {assessment.ladder.map((option, i) => (
        <Rung
          key={option.tier}
          option={option}
          index={i}
          isPrimary={option.tier === assessment.primary.tier}
          isLast={i === assessment.ladder.length - 1}
        />
      ))}
    </ol>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Estimated useful life added</p>
      <p className="text-sm font-semibold text-white/80">
        {lifeLabel(assessment.primary.usefulLifeExtensionDays)}
      </p>
    </div>
  </section>
);
