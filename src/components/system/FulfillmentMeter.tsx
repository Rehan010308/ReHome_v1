/**
 * Demand fulfillment, shown honestly.
 *
 * Three quantities, never collapsed: what the organization already received,
 * what this donor would add, and what would still be outstanding afterwards.
 * A contribution is never rendered as fulfillment.
 */
export const FulfillmentMeter = ({
  requested,
  received,
  contribution = 0,
  compact = false,
}: {
  requested: number;
  received: number;
  contribution?: number;
  compact?: boolean;
}) => {
  const safeRequested = Math.max(1, requested);
  const alreadyPct = Math.min(100, (received / safeRequested) * 100);
  const addedPct = Math.min(100 - alreadyPct, (contribution / safeRequested) * 100);
  const remainingAfter = Math.max(0, requested - received - contribution);
  const complete = remainingAfter === 0;

  return (
    <div className={compact ? "" : "space-y-2.5"}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/8" role="presentation">
        <div
          className="h-full bg-white/30 transition-[width] duration-500"
          style={{ width: `${alreadyPct}%` }}
        />
        {contribution > 0 ? (
          <div
            className="h-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-[width] duration-500 shadow-[0_0_14px_rgba(163,230,53,0.5)]"
            style={{ width: `${addedPct}%` }}
          />
        ) : null}
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-white/60">
            {contribution > 0 ? (
              <>
                <span className="font-semibold text-lime-200">
                  {received + contribution} of {requested}
                </span>{" "}
                contributed with yours
              </>
            ) : (
              <>
                <span className="font-semibold text-white/80">
                  {received} of {requested}
                </span>{" "}
                contributed so far
              </>
            )}
          </p>
          <p className={`text-sm font-semibold ${complete ? "text-lime-200" : "text-white/45"}`}>
            {complete ? "Fully met" : `${remainingAfter} still needed`}
          </p>
        </div>
      ) : null}
    </div>
  );
};
