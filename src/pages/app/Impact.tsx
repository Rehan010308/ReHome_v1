import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { EMPTY_IMPACT, fetchImpactSummary } from "@/lib/data/impact";
import { listDonorAllocations } from "@/lib/data/allocations";
import {
  CAMPUS_PROGRAMMES,
  POINT_RULES,
  REWARD_CONCEPTS,
  computeIncentives,
} from "@/services/incentives";
import { ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * Impact, told as journeys rather than as a score.
 *
 * The headline is what actually happened to real objects — three books arriving
 * at a named school — because that is the thing a donor did. Points, levels and
 * challenges sit underneath it as recognition, and every one of them is derived
 * from impact_records, which only a confirmed handoff can write.
 */
export default function Impact() {
  const { profile } = useAuth();
  const userId = profile?.userId;

  const loader = useMemo(
    () => async () => {
      if (!userId) return { impact: EMPTY_IMPACT, allocations: [] };
      const [impact, allocations] = await Promise.all([
        fetchImpactSummary(userId),
        listDonorAllocations(userId),
      ]);
      return { impact, allocations };
    },
    [userId]
  );

  const { data, loading, error } = useAsync(loader, [loader]);
  const impact = data?.impact ?? EMPTY_IMPACT;
  const allocations = data?.allocations ?? [];
  const incentives = computeIncentives(impact.records);

  /** One journey per confirmed record: what went where, and how much of it. */
  const journeys = useMemo(() => {
    const byOrg = new Map<
      string,
      { key: string; organization: string; units: number; items: Map<string, number>; allocationId: string | null }
    >();
    for (const record of impact.records) {
      const allocation = allocations.find((a) => a.id === record.allocation_id);
      // A destination the donor is not entitled to read comes back without a
      // name. Saying so is better than inventing one.
      const name = allocation?.requirement?.organization?.name ?? "A ReHome destination";
      const key = record.organization_id ?? record.id;
      const entry =
        byOrg.get(key) ??
        { key, organization: name, units: 0, items: new Map<string, number>(), allocationId: null };
      entry.units += record.quantity;
      const label = String(record.metrics?.item_type ?? allocation?.item?.item_type ?? "Item");
      entry.items.set(label, (entry.items.get(label) ?? 0) + record.quantity);
      entry.allocationId = entry.allocationId ?? record.allocation_id;
      byOrg.set(key, entry);
    }
    return [...byOrg.values()].sort((a, b) => b.units - a.units);
  }, [impact.records, allocations]);

  const earned = incentives.badges.filter((b) => b.earned);
  const upcoming = incentives.badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress - a.progress);

  const verifiedHandoffs = impact.records.length;

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{ background: "radial-gradient(70% 50% at 50% 0%, rgba(30,92,70,0.22), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-14 md:pt-20">
        <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">YOUR IMPACT</p>

        {loading ? <div className="mt-8"><LoadingState label="Loading your impact" /></div> : null}
        {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}

        {!loading && !error && impact.unitsRehomed === 0 ? (
          <>
            <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
              Nothing confirmed yet.
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/55">
              Impact appears here once an organization confirms it received something from you.
              Listing an item or accepting a destination does not count — only a completed,
              verified handoff does.
            </p>
            <Link
              to="/app/scan"
              className="mt-8 inline-flex items-center gap-2 text-[14px] text-lime-300/90 hover:text-lime-200"
            >
              Scan something unused
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : null}

        {!loading && !error && impact.unitsRehomed > 0 ? (
          <>
            {/* ── The journeys ──────────────────────────────────────── */}
            <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
              Where your things went.
            </h1>

            <ul className="mt-10 space-y-4">
              {journeys.map((journey) => {
                const parts = [...journey.items.entries()];
                return (
                  <li
                    key={journey.key}
                    className="rh-surface overflow-hidden rounded-[22px] px-6 py-6"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display text-[26px] font-bold leading-none text-lime-200">
                        {journey.units}
                      </span>
                      <span className="text-[15px] text-white/70">
                        {parts
                          .map(([label, n]) => `${n} × ${label.toLowerCase()}`)
                          .join(", ")}
                      </span>
                    </div>

                    {/* The journey, as three beats on one line. */}
                    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
                      <span className="text-white/45">You</span>
                      <span className="h-px w-8 bg-gradient-to-r from-white/25 to-lime-300/60" />
                      <span className="text-white/85">{journey.organization}</span>
                      <span className="h-px w-8 bg-gradient-to-r from-lime-300/60 to-lime-300" />
                      <span className="inline-flex items-center gap-1.5 text-lime-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {journey.units} received and in use
                      </span>
                    </div>

                    {journey.allocationId ? (
                      <Link
                        to={`/app/receipt/${journey.allocationId}`}
                        className="mt-5 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
                      >
                        View impact receipt
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* ── The totals ────────────────────────────────────────── */}
            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/[0.07] pt-9 sm:grid-cols-4">
              {[
                { v: impact.unitsRehomed, k: "items rehomed" },
                { v: impact.organizationsSupported, k: "organizations supported" },
                { v: verifiedHandoffs, k: "verified handoffs" },
                { v: incentives.points, k: "impact points" },
              ].map((stat) => (
                <div key={stat.k}>
                  <p className="font-display text-[2rem] font-bold leading-none text-white/90">
                    {stat.v}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-white/40">{stat.k}</p>
                </div>
              ))}
            </div>

            {/* ── Level ─────────────────────────────────────────────── */}
            <section className="mt-14">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-[22px] font-semibold tracking-tight text-lime-100">
                  {incentives.level.name}
                </h2>
                <p className="rh-mono text-[10px] tracking-[0.2em] text-white/35">
                  {incentives.level.nextAt
                    ? `${incentives.level.nextAt - incentives.points} POINTS TO ${incentives.level.nextName?.toUpperCase()}`
                    : "HIGHEST LEVEL"}
                </p>
              </div>
              <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-[width] duration-700"
                  style={{ width: `${Math.round(incentives.level.progress * 100)}%` }}
                />
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {POINT_RULES.map((rule) => (
                  <div key={rule.label} className="flex items-baseline gap-3">
                    <dt className="rh-mono w-8 shrink-0 text-right text-[12px] tabular-nums text-lime-200/80">
                      +{rule.points}
                    </dt>
                    <dd className="min-w-0 text-[13px] leading-snug text-white/45">
                      <span className="text-white/70">{rule.label}</span> — {rule.detail}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] leading-relaxed text-white/25">
                Points are awarded by the database when a handoff is confirmed, so they cannot be
                earned by anything that did not actually happen.
              </p>
            </section>

            {/* ── Challenges ────────────────────────────────────────── */}
            <section className="mt-14">
              <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">
                CHALLENGES THIS MONTH
              </h2>
              <ul className="mt-5 space-y-5">
                {incentives.challenges.map((challenge) => {
                  const pct = Math.min(1, challenge.current / challenge.target);
                  return (
                    <li key={challenge.id}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[15px] text-white/80">{challenge.name}</span>
                        <span className="rh-mono shrink-0 text-[12px] tabular-nums text-white/45">
                          {challenge.current}/{challenge.target}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-white/35">{challenge.description}</p>
                      <div className="mt-2.5 h-px w-full bg-white/[0.08]">
                        <div
                          className="h-px bg-lime-300/70 transition-[width] duration-500"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ── Badges ────────────────────────────────────────────── */}
            {earned.length > 0 ? (
              <section className="mt-14">
                <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">EARNED</h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {earned.map((b) => (
                    <span
                      key={b.id}
                      title={b.description}
                      className="rounded-full border border-lime-300/25 bg-lime-300/[0.07] px-4 py-2 text-[13px] font-medium text-lime-100"
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {upcoming.length > 0 ? (
              <section className="mt-10">
                <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">IN PROGRESS</h2>
                <ul className="mt-4 space-y-4">
                  {upcoming.slice(0, 3).map((b) => (
                    <li key={b.id}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[14px] text-white/70">{b.name}</span>
                        <span className="rh-mono text-[11px] text-white/30">
                          {Math.round(b.progress * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-white/30">{b.description}</p>
                      <div className="mt-2 h-px w-full bg-white/[0.08]">
                        <div
                          className="h-px bg-lime-300/50 transition-[width] duration-500"
                          style={{ width: `${b.progress * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* ── Certificate ───────────────────────────────────────── */}
            <section className="mt-14 border-t border-white/[0.07] pt-9">
              <div className="flex flex-wrap items-center gap-5">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                    incentives.certificateEarned
                      ? "bg-gradient-to-br from-lime-300 to-emerald-400 text-[#06231a]"
                      : "border border-white/10 text-white/25"
                  }`}
                >
                  <Award className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[17px] font-semibold tracking-tight">
                    ReHome Circularity Contributor
                  </p>
                  <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/40">
                    {incentives.certificateEarned
                      ? "Earned — ten or more items confirmed in their next home."
                      : `Awarded at ten confirmed items. You are at ${impact.unitsRehomed}.`}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Programmes and rewards ────────────────────────────── */}
            <section className="mt-14">
              <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">
                CAMPUS PROGRAMMES
              </h2>
              <ul className="mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {CAMPUS_PROGRAMMES.map((programme) => (
                  <li key={programme.id} className="flex items-start justify-between gap-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[15px] text-white/80">{programme.name}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/35">
                        {programme.description}
                      </p>
                    </div>
                    <span className="rh-mono shrink-0 text-[9.5px] tracking-[0.18em] text-white/25">
                      NOT OPEN YET
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] leading-relaxed text-white/25">
                Standings need a cross-user aggregate that row-level security correctly stops the
                browser from reading. Until that exists server-side, no ranking is shown rather
                than an invented one.
              </p>
            </section>

            <section className="mt-12">
              <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">PARTNER REWARDS</h2>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {REWARD_CONCEPTS.map((reward) => (
                  <span
                    key={reward.id}
                    title={reward.note}
                    className="rounded-full border border-white/[0.09] px-4 py-2 text-[13px] text-white/45"
                  >
                    {reward.name}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-white/25">
                Reward categories only. No partner is named until an agreement exists, and points
                are never exchanged for cash — ReHome recognises contribution, it does not buy it.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
