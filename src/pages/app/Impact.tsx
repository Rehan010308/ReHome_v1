import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { EMPTY_IMPACT, fetchImpactSummary } from "@/lib/data/impact";
import { computeIncentives } from "@/services/incentives";
import { StatusBadge } from "@/components/system/primitives";
import { ErrorState, LoadingState } from "@/components/system/DataState";

export default function Impact() {
  const { profile } = useAuth();
  const userId = profile?.userId;

  const { data, loading, error } = useAsync(
    async () => (userId ? fetchImpactSummary(userId) : EMPTY_IMPACT),
    [userId]
  );

  const impact = data ?? EMPTY_IMPACT;
  const incentives = computeIncentives(impact.records);
  const earned = incentives.badges.filter((b) => b.earned);
  const upcoming = incentives.badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      <StatusBadge>Impact</StatusBadge>

      {loading ? <div className="mt-8"><LoadingState label="Loading your impact" /></div> : null}
      {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}

      {!loading && !error && impact.unitsRehomed === 0 ? (
        <>
          <h1 className="mt-5 font-display text-3xl md:text-4xl font-bold tracking-tight">
            Nothing confirmed yet
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-white/55">
            Impact appears here once an organization confirms it received something from you.
            Listing an item or accepting a match does not count — only a completed handoff does.
          </p>
        </>
      ) : null}

      {!loading && !error && impact.unitsRehomed > 0 ? (
        <>
          <h1 className="mt-5 font-display text-5xl md:text-6xl font-bold leading-none tracking-tight">
            {impact.unitsRehomed}
            <span className="ml-3 align-middle font-display text-base font-medium text-white/45">
              {impact.unitsRehomed === 1 ? "item given a second life" : "items given a second life"}
            </span>
          </h1>

          {/* Concrete outcomes, in the user's own terms. */}
          <ul className="mt-10 border-t border-white/8">
            {impact.byCategory.map((c) => (
              <li key={c.category} className="flex items-baseline justify-between border-b border-white/8 py-4">
                <span className="text-white/70">{c.category}</span>
                <span className="font-display text-lg font-semibold">{c.units}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between border-b border-white/8 py-4">
              <span className="text-white/70">Organizations supported</span>
              <span className="font-display text-lg font-semibold">{impact.organizationsSupported}</span>
            </li>
          </ul>

          {/* Score + streak */}
          <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Impact score</p>
              <p className="mt-2 font-display text-3xl font-bold text-lime-200">{incentives.points}</p>
              <p className="mt-1 text-xs text-white/40">
                {incentives.level.name}
                {incentives.level.nextAt
                  ? ` · ${incentives.level.nextAt - incentives.points} to next`
                  : " · highest level"}
              </p>
            </div>
            {incentives.streakWeeks > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Streak</p>
                <p className="mt-2 font-display text-3xl font-bold">{incentives.streakWeeks}</p>
                <p className="mt-1 text-xs text-white/40">
                  {incentives.streakWeeks === 1 ? "week" : "consecutive weeks"}
                </p>
              </div>
            ) : null}
          </div>

          {/* Badges */}
          {earned.length > 0 ? (
            <div className="mt-12">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Earned</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {earned.map((b) => (
                  <span
                    key={b.id}
                    title={b.description}
                    className="rounded-full border border-lime-300/25 bg-lime-300/8 px-4 py-2 text-xs font-semibold text-lime-100"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {upcoming.length > 0 ? (
            <div className="mt-10">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">In progress</p>
              <ul className="mt-4 space-y-4">
                {upcoming.slice(0, 3).map((b) => (
                  <li key={b.id}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-white/70">{b.name}</span>
                      <span className="text-xs text-white/30">{Math.round(b.progress * 100)}%</span>
                    </div>
                    <p className="mt-1 text-xs text-white/35">{b.description}</p>
                    <div className="mt-2 h-px w-full bg-white/8">
                      <div
                        className="h-px bg-lime-300/60 transition-[width] duration-500"
                        style={{ width: `${b.progress * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-12 border-t border-white/8 pt-6 text-xs leading-relaxed text-white/30">
            Leaderboards are not shown because ranking requires reading other people's records,
            which row-level security correctly prevents from the browser. That needs a
            server-side aggregate exposing ranks without exposing rows — until it exists,
            showing standings here would mean inventing them.
          </p>
        </>
      ) : null}
    </div>
  );
}
