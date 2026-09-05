import { Link } from "react-router-dom";
import { ArrowRight, Camera, HeartHandshake } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { listOwnItems } from "@/lib/data/catalog";
import { listMatchesForOwner } from "@/lib/data/matches";
import {
  AnimatedBackground,
  DashboardCard,
  DataPanel,
  GlowButton,
  StatusBadge,
} from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

const stages = ["Object", "Scanning", "Understanding", "Structuring", "Matching", "Destination"];

export default function IndividualDashboard() {
  const { profile } = useAuth();
  const itemsQuery = useAsync(async () => (profile ? listOwnItems(profile.userId) : []), [profile?.userId]);
  const matchesQuery = useAsync(async () => (profile ? listMatchesForOwner(profile.userId) : []), [profile?.userId]);

  const items = itemsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const topMatch = matches[0];

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        <StatusBadge>Individual command center</StatusBadge>
        <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight">
          Welcome back, {profile?.name.split(" ")[0]}
        </h1>
        <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
          Scan unused objects, confirm what they are, and send them toward the organization that
          can use them next.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {stages.map((stage, i) => (
            <span
              key={stage}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/55"
              style={{ opacity: 1 - i * 0.08 }}
            >
              {stage}
            </span>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DataPanel label="Items listed" value={String(items.length)} hint="Stored in your ReHome inventory" />
          <DataPanel
            label="Active matches"
            value={String(matches.filter((m) => m.status === "suggested" || m.status === "accepted").length)}
            hint={topMatch ? `Top score ${Math.round(Number(topMatch.match_score))}%` : "Scan to generate matches"}
          />
          <DataPanel label="Location" value={profile?.location?.trim() || "—"} hint="Used for proximity scoring" />
          <DataPanel label="Account" value="Live" hint="Supabase session + profile row" />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashboardCard
            title="Scan an item"
            description="Photograph an unused object. Browser vision proposes a profile; you confirm it before it is stored."
            action={
              <Link to="/app/scan">
                <GlowButton>
                  Open scanner
                  <ArrowRight className="h-4 w-4" />
                </GlowButton>
              </Link>
            }
          >
            <div className="flex items-center gap-3 text-sm text-white/50">
              <Camera className="h-4 w-4 text-lime-300" />
              COCO-SSD baseline in the browser. Optional cloud AI stays on the server.
            </div>
          </DashboardCard>

          <DashboardCard
            title="Analyzed items"
            description="Confirmed item records persist in Supabase — not mock storage."
            action={
              <Link to="/app/scan" className="text-xs uppercase tracking-[0.16em] text-lime-200">
                Add item
              </Link>
            }
          >
            {itemsQuery.loading ? <LoadingState label="Loading items" /> : null}
            {itemsQuery.error ? <ErrorState message={itemsQuery.error} /> : null}
            {!itemsQuery.loading && !itemsQuery.error && items.length === 0 ? (
              <EmptyState message="No items yet — start with a scan." />
            ) : null}
            <ul className="space-y-2">
              {items.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b border-white/8 pb-2 text-sm">
                  <span>
                    {item.item_type}
                    <span className="ml-2 text-white/40">{item.category}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">{item.status}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          <DashboardCard
            title="Rehoming activity"
            description="Ranked supply-to-demand matches with the reasons they were recommended."
            action={
              <Link to="/app/matches">
                <GlowButton variant="ghost">
                  Open matches
                  <ArrowRight className="h-4 w-4" />
                </GlowButton>
              </Link>
            }
          >
            {matchesQuery.loading ? <LoadingState label="Loading matches" /> : null}
            {matchesQuery.error ? <ErrorState message={matchesQuery.error} /> : null}
            {!matchesQuery.loading && !matchesQuery.error && matches.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-white/50">
                <HeartHandshake className="h-4 w-4 text-lime-300" />
                No matches yet. Listed items are scored against open requirements.
              </div>
            ) : null}
            {topMatch ? (
              <p className="text-sm text-white/60">
                {Math.round(Number(topMatch.match_score))}% · {topMatch.item?.item_type} →{" "}
                {topMatch.requirement?.organization?.name ?? "organization"}
              </p>
            ) : null}
          </DashboardCard>

          <DashboardCard title="Impact preview" description="Confirmed outcomes are recorded only after a later handoff phase.">
            <p className="text-sm text-white/50">
              Listed items are real. Impact totals stay empty until a handoff is confirmed.
            </p>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
