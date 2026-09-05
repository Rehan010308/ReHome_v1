import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { Camera, PenLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { listOwnItems } from "@/lib/data/catalog";
import { listMatchesForOwner } from "@/lib/data/matches";
import { EMPTY_IMPACT, fetchImpactSummary } from "@/lib/data/impact";
import type { ItemRow, ItemStatus } from "@/types/database";
import { ErrorState, LoadingState } from "@/components/system/DataState";

const SpatialNetwork = lazy(() => import("@/components/spatial/SpatialNetwork"));

/**
 * Lifecycle in the user's language, plus how far along it is. The progress
 * value drives the colour of that item's solid in the spatial network, so the
 * visualisation and the list are two readings of the same state.
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

  const active = items.filter(
    (i) => i.status !== "second_life_confirmed" && i.status !== "withdrawn"
  );

  const spatialObjects = useMemo(
    () => active.map((i) => ({ id: i.id, progress: STAGE[i.status]?.progress ?? 0.1 })),
    [active]
  );
  const spatialDestinations = useMemo(
    () =>
      matches.slice(0, 6).map((m) => ({
        id: m.id,
        strength: Math.min(1, Math.max(0.2, Number(m.match_score) / 100)),
      })),
    [matches]
  );

  const firstName = profile?.name?.split(" ")[0];

  return (
    <div className="relative min-h-screen">
      {/* Environmental light. One source, low and behind the stage. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px]"
        style={{
          background:
            "radial-gradient(80% 55% at 50% 0%, rgba(30,92,70,0.30), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-14 md:pt-20">
        {/* ── Opening statement + the two ways in ─────────────────────── */}
        <header className="max-w-2xl">
          {firstName ? (
            <p className="mb-4 text-[14px] text-white/35">Welcome back, {firstName}</p>
          ) : null}
          <h1 className="font-display text-[clamp(2.1rem,5.4vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.02em]">
            Turn something unused
            <span className="block text-white/40">into something useful.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
            Show ReHome an object. It works out what it is, what state it is in, and where it can
            do the most good next.
          </p>
        </header>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/app/scan"
            className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-9 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#06231a] transition-transform duration-300 hover:-translate-y-0.5"
            style={{ boxShadow: "0 0 50px rgba(163,230,53,0.28)" }}
          >
            <Camera className="h-4 w-4" />
            Scan an item
          </Link>
          <Link
            to="/app/add"
            className="inline-flex items-center justify-center gap-2.5 rounded-full border border-white/12 px-7 py-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            <PenLine className="h-3.5 w-3.5" />
            Add manually
          </Link>
        </div>

        {/* ── The system, drawn ───────────────────────────────────────── */}
        <section className="relative mt-14">
          <div
            className="relative overflow-hidden rounded-[28px] border border-white/[0.07]"
            style={{
              background: "linear-gradient(180deg, rgba(9,17,22,0.9), rgba(5,10,16,0.75))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 50px 120px -60px rgba(0,0,0,0.9)",
            }}
          >
            <Suspense
              fallback={
                <div className="grid h-[260px] place-items-center md:h-[330px]">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-lime-300" />
                </div>
              }
            >
              <SpatialNetwork
                objects={spatialObjects}
                destinations={spatialDestinations}
                className="h-[260px] w-full md:h-[330px]"
              />
            </Suspense>

            {/* Lane legend, anchored under what it names. */}
            <div className="grid grid-cols-3 border-t border-white/[0.06] text-center">
              {[
                { k: "Object", v: active.length, n: active.length === 1 ? "item" : "items" },
                { k: "ReHome intelligence", v: null, n: "reading condition and demand" },
                { k: "Destination", v: matches.length, n: matches.length === 1 ? "found" : "found" },
              ].map((lane, i) => (
                <div
                  key={lane.k}
                  className={`px-3 py-5 ${i === 1 ? "border-x border-white/[0.06]" : ""}`}
                >
                  <p className="text-[11px] font-medium text-white/40">{lane.k}</p>
                  <p className="mt-1.5 font-display text-lg font-semibold tabular-nums">
                    {lane.v !== null ? lane.v : <span className="text-lime-300/80">Live</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/25">{lane.n}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What is moving right now ────────────────────────────────── */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold tracking-tight">In motion</h2>
            {matches.length > 0 ? (
              <Link to="/app/matches" className="text-[13px] text-lime-300/90 hover:text-lime-200">
                Review destinations
              </Link>
            ) : null}
          </div>

          <div className="mt-5">
            {itemsQuery.loading ? <LoadingState label="Loading your items" /> : null}
            {itemsQuery.error ? <ErrorState message={itemsQuery.error} /> : null}

            {!itemsQuery.loading && !itemsQuery.error && active.length === 0 ? (
              <p className="max-w-sm text-[15px] leading-relaxed text-white/35">
                Nothing in motion. Scan the first thing you no longer use and ReHome will take it
                from there.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {active.map((item: ItemRow) => {
                  const stage = STAGE[item.status];
                  return (
                    <li key={item.id} className="flex items-center gap-4 py-4">
                      {/* Depth cue: the further along, the brighter the marker. */}
                      <span
                        className="h-8 w-[3px] shrink-0 rounded-full"
                        style={{
                          background: `linear-gradient(to top, rgba(163,230,53,${0.15 + stage.progress * 0.85}), rgba(163,230,53,0.05))`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-white/90">
                          {item.item_type}
                          {item.quantity > 1 ? (
                            <span className="ml-2 text-white/35">{item.quantity}</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[13px] text-white/30">{item.category}</p>
                      </div>
                      <span className="shrink-0 text-[13px] text-white/55">{stage.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── What already landed ─────────────────────────────────────── */}
        {impact.unitsRehomed > 0 ? (
          <section className="mt-16 border-t border-white/[0.07] pt-10">
            <h2 className="font-display text-xl font-semibold tracking-tight">Already rehomed</h2>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-12 gap-y-6">
              <p className="font-display text-[3.2rem] font-bold leading-none text-lime-200">
                {impact.unitsRehomed}
                <span className="ml-3 align-middle text-[15px] font-medium text-white/45">
                  given a second life
                </span>
              </p>
              {impact.organizationsSupported > 0 ? (
                <p className="text-[15px] text-white/45">
                  <span className="font-display text-2xl font-semibold text-white/85">
                    {impact.organizationsSupported}
                  </span>{" "}
                  {impact.organizationsSupported === 1 ? "organization" : "organizations"} supported
                </p>
              ) : null}
              <Link to="/app/impact" className="text-[13px] text-lime-300/90 hover:text-lime-200">
                See your impact
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
