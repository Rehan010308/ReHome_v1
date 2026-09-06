import { Link } from "react-router-dom";
import { ArrowRight, Camera, PenLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRehomingSession } from "@/context/SessionContext";
import { useAsync } from "@/hooks/useAsync";
import { listOwnItems } from "@/lib/data/catalog";
import { listMatchesForOwner } from "@/lib/data/matches";
import { EMPTY_IMPACT, fetchImpactSummary } from "@/lib/data/impact";
import { computeIncentives } from "@/services/incentives";
import type { ItemRow, ItemStatus } from "@/types/database";
import { IntelligenceSurface } from "@/components/system/IntelligenceSurface";
import { ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * Lifecycle in the user's language, plus how far along it is. The value drives
 * the progress hairline on each row, so the list and the rail are two readings
 * of the same state.
 */
const STAGE: Record<ItemStatus, { label: string; progress: number }> = {
  listed: { label: "Ready to route", progress: 0.1 },
  analyzing: { label: "Being analysed", progress: 0.2 },
  confirmed: { label: "Ready to route", progress: 0.3 },
  matched: { label: "Destination found", progress: 0.5 },
  allocated: { label: "Awaiting handoff", progress: 0.65 },
  handoff_scheduled: { label: "Handoff scheduled", progress: 0.8 },
  handed_over: { label: "Awaiting confirmation", progress: 0.9 },
  second_life_confirmed: { label: "Second life confirmed", progress: 1 },
  withdrawn: { label: "Withdrawn", progress: 0 },
};

export default function IndividualDashboard() {
  const { profile } = useAuth();
  const { active, entries } = useRehomingSession();
  const userId = profile?.userId;

  const itemsQuery = useAsync(async () => (userId ? listOwnItems(userId) : []), [userId]);
  const matchesQuery = useAsync(async () => (userId ? listMatchesForOwner(userId) : []), [userId]);
  const impactQuery = useAsync(
    async () => (userId ? fetchImpactSummary(userId) : EMPTY_IMPACT),
    [userId]
  );

  const items = itemsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const impact = impactQuery.data ?? EMPTY_IMPACT;
  const incentives = computeIncentives(impact.records);

  const inMotion = items.filter(
    (i) => i.status !== "second_life_confirmed" && i.status !== "withdrawn"
  );

  // The surface reflects the live session when one is running, and the last
  // settled reading otherwise — never an invented state.
  const lastSettled = [...entries].reverse().find((e) => e.stage === "destination_found");
  const surfaceEntry = active ?? lastSettled ?? null;

  const firstName = profile?.name?.split(" ")[0];

  return (
    <div className="relative min-h-screen">
      {/* Environmental light. One source, low and behind everything. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background: "radial-gradient(75% 52% at 50% 0%, rgba(30,92,70,0.26), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 pb-28 pt-14 md:pt-20">
        {/* ── Opening statement ───────────────────────────────────────── */}
        <header className="max-w-2xl">
          <p className="rh-mono text-[10px] tracking-[0.34em] text-lime-200/60">COMMAND CENTER</p>
          {firstName ? (
            <p className="mt-5 text-[14px] text-white/35">Welcome back, {firstName}</p>
          ) : null}
          <h1 className="mt-3 font-display text-[clamp(2.1rem,5.4vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.02em]">
            Turn something unused
            <span className="block text-white/40">into something useful.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
            Point your camera at an object you no longer need. ReHome works out what it is, what
            state it is in, and where it can do the most good next.
          </p>
        </header>

        {/* ── The two ways in ─────────────────────────────────────────── */}
        <Link
          to="/app/scan"
          className="group relative mt-10 block overflow-hidden rounded-[26px] border border-lime-300/25 transition-all duration-500 hover:-translate-y-0.5 hover:border-lime-300/45"
          style={{
            background: "linear-gradient(135deg, rgba(30,92,70,0.35), rgba(9,17,22,0.9) 62%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 90px -50px rgba(163,230,53,0.45)",
          }}
        >
          <span
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-70 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: "radial-gradient(circle, rgba(163,230,53,0.20), transparent 68%)" }}
            aria-hidden
          />
          <span className="relative flex flex-wrap items-center gap-5 px-6 py-7 sm:px-8">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lime-300 to-emerald-400 text-[#06231a] transition-transform duration-500 group-hover:scale-105"
              style={{ boxShadow: "0 0 40px rgba(163,230,53,0.35)" }}
            >
              <Camera className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[clamp(1.4rem,3.4vw,1.9rem)] font-bold leading-tight tracking-[-0.02em]">
                Scan an item
              </span>
              <span className="mt-1.5 block text-[14px] leading-relaxed text-white/50">
                Open the camera, or upload a photo. ReHome reads it and finds the destination.
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-lime-300 transition-transform duration-500 group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          to="/app/add"
          className="mt-4 inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/45 transition-colors hover:text-white/80"
        >
          <PenLine className="h-3.5 w-3.5" />
          Add item manually
        </Link>

        {/* ── ReHome Intelligence ─────────────────────────────────────── */}
        <div className="mt-14">
          <IntelligenceSurface
            stage={surfaceEntry?.stage ?? "idle"}
            telemetry={surfaceEntry?.telemetry ?? {}}
          />
        </div>

        {/* ── Your active rehoming ────────────────────────────────────── */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">
              YOUR ACTIVE REHOMING
            </h2>
            {matches.length > 0 ? (
              <Link to="/app/matches" className="text-[13px] text-lime-300/90 hover:text-lime-200">
                Review destinations
              </Link>
            ) : null}
          </div>

          <div className="mt-6">
            {itemsQuery.loading ? <LoadingState label="Loading your items" /> : null}
            {itemsQuery.error ? <ErrorState message={itemsQuery.error} /> : null}

            {!itemsQuery.loading && !itemsQuery.error && inMotion.length === 0 ? (
              <p className="max-w-sm text-[15px] leading-relaxed text-white/35">
                Nothing in motion. Scan the first thing you no longer use and ReHome will take it
                from there.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {inMotion.map((item: ItemRow, i) => {
                  const stage = STAGE[item.status];
                  return (
                    <li key={item.id} className="flex items-center gap-4 py-4">
                      <span className="rh-mono w-6 shrink-0 text-[10px] tabular-nums text-white/20">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-white/90">
                          {item.item_type}
                          {item.quantity > 1 ? (
                            <span className="ml-2 text-white/35">×{item.quantity}</span>
                          ) : null}
                        </p>
                        <div className="mt-2 h-px w-full max-w-[220px] bg-white/[0.07]">
                          <div
                            className="h-px bg-gradient-to-r from-lime-300/40 to-lime-300 transition-[width] duration-700"
                            style={{ width: `${stage.progress * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] text-white/55">{stage.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Your impact ─────────────────────────────────────────────── */}
        <section className="mt-16 border-t border-white/[0.07] pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="rh-mono text-[10px] tracking-[0.3em] text-white/40">YOUR IMPACT</h2>
            <Link to="/app/impact" className="text-[13px] text-lime-300/90 hover:text-lime-200">
              Open impact
            </Link>
          </div>

          {impact.unitsRehomed === 0 ? (
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/35">
              Impact is recorded when an organization confirms it received something from you.
              Listing an item or accepting a destination does not count — only a completed handoff.
            </p>
          ) : (
            <div className="mt-7 flex flex-wrap items-baseline gap-x-14 gap-y-7">
              <div>
                <p className="font-display text-[3.2rem] font-bold leading-none text-lime-200">
                  {impact.unitsRehomed}
                </p>
                <p className="mt-2 text-[13px] text-white/45">given a second life</p>
              </div>
              <div>
                <p className="font-display text-[2rem] font-semibold leading-none text-white/85">
                  {impact.organizationsSupported}
                </p>
                <p className="mt-2 text-[13px] text-white/45">
                  {impact.organizationsSupported === 1 ? "organization" : "organizations"} supported
                </p>
              </div>
              <div>
                <p className="font-display text-[2rem] font-semibold leading-none text-white/85">
                  {incentives.points}
                </p>
                <p className="mt-2 text-[13px] text-white/45">
                  impact points · {incentives.level.name}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
