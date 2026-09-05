import { Link } from "react-router-dom";
import { ArrowRight, Camera } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { listOwnItems } from "@/lib/data/catalog";
import { fetchImpactSummary, EMPTY_IMPACT } from "@/lib/data/impact";
import type { ItemRow, ItemStatus } from "@/types/database";
import { AnimatedBackground } from "@/components/system/primitives";
import { ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * Lifecycle in plain language. The user should never have to learn the
 * database's vocabulary to understand where their item is.
 */
const STAGE: Record<ItemStatus, { label: string; done?: boolean; live?: boolean }> = {
  listed: { label: "Ready to route" },
  analyzing: { label: "Being analysed", live: true },
  confirmed: { label: "Ready to route" },
  matched: { label: "Destinations found", live: true },
  allocated: { label: "Committed — awaiting handoff", live: true },
  handoff_scheduled: { label: "Handoff scheduled", live: true },
  handed_over: { label: "Handed over", live: true },
  second_life_confirmed: { label: "Second life confirmed", done: true },
  withdrawn: { label: "Withdrawn" },
};

const ItemLine = ({ item }: { item: ItemRow }) => {
  const stage = STAGE[item.status] ?? { label: item.status };
  return (
    <li className="flex items-center justify-between gap-4 border-b border-white/6 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/85">
          {item.item_type}
          {item.quantity > 1 ? <span className="ml-1.5 text-white/40">×{item.quantity}</span> : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/35">{item.category}</p>
      </div>
      <span
        className={`shrink-0 text-xs ${
          stage.done ? "text-lime-200" : stage.live ? "text-white/70" : "text-white/35"
        }`}
      >
        {stage.live ? (
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-lime-300 align-middle" />
        ) : null}
        {stage.label}
      </span>
    </li>
  );
};

export default function IndividualDashboard() {
  const { profile } = useAuth();
  const userId = profile?.userId;

  const itemsQuery = useAsync(async () => (userId ? listOwnItems(userId) : []), [userId]);
  const impactQuery = useAsync(
    async () => (userId ? fetchImpactSummary(userId) : EMPTY_IMPACT),
    [userId]
  );

  const items = itemsQuery.data ?? [];
  const impact = impactQuery.data ?? EMPTY_IMPACT;

  const inMotion = items.filter(
    (i) => i.status !== "second_life_confirmed" && i.status !== "withdrawn"
  );

  return (
    <div className="relative">
      <AnimatedBackground />

      <div className="relative mx-auto max-w-3xl px-4 py-12 md:py-20">
        {/* PRIMARY ACTION — everything else is secondary to this. */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-lime-200/70">
          {profile?.name?.split(" ")[0] ?? "Welcome"}
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-[1.03] tracking-tight">
          What can you
          <span className="block bg-gradient-to-r from-lime-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
            rehome today?
          </span>
        </h1>
        <p className="mt-5 max-w-lg leading-relaxed text-white/55">
          Photograph something you no longer use. ReHome works out what it is, what
          condition it is in, and where it can create the most value next.
        </p>

        <Link
          to="/app/scan"
          className="group mt-8 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-9 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#06231a] shadow-[0_0_44px_rgba(163,230,53,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_64px_rgba(163,230,53,0.45)]"
        >
          <Camera className="h-4 w-4" />
          Scan an item
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>

        {/* CURRENT STATE */}
        <div className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Your items</h2>
            {inMotion.length > 0 ? (
              <Link
                to="/app/matches"
                className="text-xs uppercase tracking-[0.16em] text-lime-200/80 hover:text-lime-200"
              >
                Review destinations
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            {itemsQuery.loading ? <LoadingState label="Loading your items" /> : null}
            {itemsQuery.error ? <ErrorState message={itemsQuery.error} /> : null}

            {!itemsQuery.loading && !itemsQuery.error && inMotion.length === 0 ? (
              <p className="border-t border-white/6 pt-6 text-sm leading-relaxed text-white/35">
                Nothing in motion yet. Your first scan starts here.
              </p>
            ) : (
              <ul className="border-t border-white/6">
                {inMotion.map((item) => (
                  <ItemLine key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* IMPACT — only once it is real. */}
        {impact.unitsRehomed > 0 ? (
          <div className="mt-14 border-t border-white/8 pt-8">
            <h2 className="font-display text-lg font-semibold">Given a second life</h2>
            <p className="mt-4 font-display text-4xl font-bold text-lime-200">
              {impact.unitsRehomed}
              <span className="ml-2 align-middle text-base font-medium text-white/45">
                {impact.unitsRehomed === 1 ? "item" : "items"} confirmed
              </span>
            </p>
            <p className="mt-3 text-sm text-white/50">
              {impact.byCategory
                .slice(0, 4)
                .map((c) => `${c.units} ${c.category.toLowerCase()}`)
                .join(" · ")}
              {impact.organizationsSupported > 0
                ? ` — ${impact.organizationsSupported} organization${impact.organizationsSupported === 1 ? "" : "s"} supported`
                : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
