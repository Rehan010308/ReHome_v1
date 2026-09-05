import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listMatchesForOrganization, listMatchesForOwner, setMatchStatus } from "@/lib/data/matches";
import type { MatchWithContext } from "@/types/database";
import { AnimatedBackground, GlowButton, StatusBadge } from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

function MatchCard({
  row,
  onStatus,
  busyId,
}: {
  row: MatchWithContext;
  onStatus: (id: string, status: "accepted" | "declined") => void;
  busyId: string | null;
}) {
  const org = row.requirement?.organization;
  const item = row.item;
  const factors = row.matching_factors ?? [];

  return (
    <article className="rh-card rounded-[22px] p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-lime-200">{Math.round(Number(row.match_score))}% match</p>
          <p className="mt-1 text-sm text-white/70">
            {item?.item_type ?? "Item"} → {row.requirement?.item_type ?? "requirement"}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {org?.name ?? "Organization"} · {row.status}
          </p>
        </div>
        {row.status === "suggested" ? (
          <div className="flex gap-2">
            <GlowButton disabled={busyId === row.id} onClick={() => onStatus(row.id, "accepted")}>
              {busyId === row.id ? "Saving…" : "Accept"}
            </GlowButton>
            <GlowButton variant="ghost" disabled={busyId === row.id} onClick={() => onStatus(row.id, "declined")}>
              Decline
            </GlowButton>
          </div>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {factors.map((factor) => (
          <li key={factor} className="text-sm text-white/60">
            {factor}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Matches() {
  const { profile } = useAuth();
  const isOrg = profile?.accountType === "organization";
  const [busyId, setBusyId] = useState<string | null>(null);

  const loader = useMemo(
    () => async () => {
      if (!profile) return [] as MatchWithContext[];
      if (isOrg) {
        const org = await fetchOwnOrganization(profile.userId);
        if (!org) return [];
        return listMatchesForOrganization(org.id);
      }
      return listMatchesForOwner(profile.userId);
    },
    [isOrg, profile]
  );

  const { data, loading, error, reload } = useAsync(loader, [loader]);

  const onStatus = async (id: string, status: "accepted" | "declined") => {
    setBusyId(id);
    try {
      await setMatchStatus(id, status);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
        <StatusBadge>Intelligent matching</StatusBadge>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Matches</h1>
        <p className="mt-3 text-white/55 leading-relaxed">
          Available resources scored against real demand. Each recommendation shows why it is the
          highest-value destination among open requirements.
        </p>

        <div className="mt-8 space-y-4">
          {loading ? <LoadingState label="Scoring destinations" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {!loading && !error && (data?.length ?? 0) === 0 ? (
            <EmptyState message={isOrg ? "No incoming matches yet." : "Scan an item to generate matches."} />
          ) : null}
          {data?.map((row) => (
            <MatchCard key={row.id} row={row} onStatus={onStatus} busyId={busyId} />
          ))}
        </div>
      </div>
    </div>
  );
}
