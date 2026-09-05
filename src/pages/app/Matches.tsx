import { useMemo, useState } from "react";
import { Check, ChevronRight, MapPin, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listMatchesForOrganization, listMatchesForOwner, setMatchStatus } from "@/lib/data/matches";
import { allocateToRequirement } from "@/lib/data/allocations";
import type { MatchWithContext } from "@/types/database";
import type { MatchFactor } from "@/services/matching/engine";
import { formatDistance } from "@/services/geo";
import { GlowButton, StatusBadge } from "@/components/system/primitives";
import { FulfillmentMeter } from "@/components/system/FulfillmentMeter";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

/** Factors are stored as jsonb objects; the row type still says string[]. */
function factorsOf(row: MatchWithContext): MatchFactor[] {
  return (row.matching_factors as unknown as MatchFactor[]) ?? [];
}

const urgencyLabel: Record<string, string> = {
  critical: "Critical need",
  high: "High demand",
  medium: "Steady demand",
  low: "Low urgency",
};

/**
 * The primary decision. One destination, the reason for it, and what it would
 * actually contribute — then Accept or Not a fit. Everything else is secondary.
 */
function PrimaryMatch({
  row,
  onAccept,
  onDecline,
  busy,
}: {
  row: MatchWithContext;
  onAccept: (row: MatchWithContext, quantity: number) => void;
  onDecline: (row: MatchWithContext) => void;
  busy: boolean;
}) {
  const req = row.requirement;
  const org = req?.organization;
  const item = row.item;

  const requested = req?.quantity_requested ?? 0;
  const received = req?.quantity_received ?? 0;
  const remaining = Math.max(0, requested - received);
  const available = item?.quantity_available ?? item?.quantity ?? 1;
  const maxContribution = Math.max(1, Math.min(available, remaining));

  const [quantity, setQuantity] = useState(maxContribution);
  const [showDetail, setShowDetail] = useState(false);

  const factors = factorsOf(row);
  const positives = factors.filter((f) => f.kind === "positive");
  const cautions = factors.filter((f) => f.kind === "caution");
  const distance = formatDistance(row.distance_km);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#080e14]">
      {/* A single accent, not a gradient field. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(163,230,53,0.5), transparent)" }}
      />

      <div className="p-6 md:p-8">
        <p className="inline-flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-lime-200/80">
          <span className="h-px w-6 bg-lime-300/40" />
          Best destination
        </p>

        <h2 className="mt-5 font-display text-3xl md:text-4xl font-bold leading-[1.05] tracking-tight">
          {org?.name ?? "Organization"}
        </h2>

        <p className="mt-2.5 text-white/60">
          Needs {req?.item_type?.toLowerCase() ?? "this item"}
          {org?.is_directory ? (
            <span className="ml-2 rounded-full border border-white/12 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-white/40">
              Seeded demo org
            </span>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/50">
          {distance ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-lime-300/70" />
              {distance}
            </span>
          ) : null}
          {req?.urgency ? <span>{urgencyLabel[req.urgency] ?? req.urgency}</span> : null}
          {org?.verification_status === "verified" ? <span>Verified</span> : null}
        </div>

        {/* Contribution — the heart of the decision. */}
        <div className="mt-8 rounded-[18px] border border-white/8 bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Your contribution</p>
              <p className="mt-1.5 font-display text-2xl font-bold text-lime-200">
                {quantity} {quantity === 1 ? "unit" : "units"}
              </p>
            </div>

            {available > 1 && remaining > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Contribute one fewer"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-full border border-white/12 text-white/70 hover:bg-white/5 disabled:opacity-30"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Contribute one more"
                  onClick={() => setQuantity((q) => Math.min(maxContribution, q + 1))}
                  className="h-9 w-9 rounded-full border border-white/12 text-white/70 hover:bg-white/5 disabled:opacity-30"
                  disabled={quantity >= maxContribution}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <FulfillmentMeter requested={requested} received={received} contribution={quantity} />
          </div>
        </div>

        {/* Why — short, plain, and honest about doubt. */}
        <div className="mt-7">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Why this match</p>
          <ul className="mt-3.5 space-y-2">
            {positives.slice(0, showDetail ? positives.length : 4).map((f) => (
              <li key={f.label} className="flex items-start gap-2.5 text-sm text-white/70">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" />
                {f.label}
              </li>
            ))}
            {cautions.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5 text-sm text-amber-100/70">
                <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-center text-[11px] leading-none text-amber-300">!</span>
                {f.label}
              </li>
            ))}
          </ul>

          {positives.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowDetail((s) => !s)}
              className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-white/40 hover:text-white/70"
            >
              {showDetail ? "Less" : "View details"}
              <ChevronRight className={`h-3 w-3 transition-transform ${showDetail ? "rotate-90" : ""}`} />
            </button>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <GlowButton disabled={busy} onClick={() => onAccept(row, quantity)} className="sm:flex-1">
            {busy ? "Committing…" : "Accept"}
          </GlowButton>
          <GlowButton variant="ghost" disabled={busy} onClick={() => onDecline(row)}>
            <X className="h-4 w-4" />
            Not a fit
          </GlowButton>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-white/30">
          Accepting reserves your {quantity === 1 ? "unit" : `${quantity} units`} against this
          requirement. It is not counted as rehomed until the organization confirms the handoff.
        </p>
      </div>
    </section>
  );
}

/** Alternatives stay quiet: one line each, promoted on click. */
function AlternativeRow({ row, onSelect }: { row: MatchWithContext; onSelect: () => void }) {
  const req = row.requirement;
  const distance = formatDistance(row.distance_km);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center justify-between gap-4 border-b border-white/6 py-4 text-left last:border-b-0 hover:border-white/15"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/80">
          {req?.organization?.name ?? "Organization"}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/40">
          {req?.item_type}
          {distance ? ` · ${distance}` : ""}
          {req ? ` · ${req.quantity_received}/${req.quantity_requested} met` : ""}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
    </button>
  );
}

export default function Matches() {
  const { profile } = useAuth();
  const isOrg = profile?.accountType === "organization";
  const userId = profile?.userId;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loader = useMemo(
    () => async () => {
      if (!userId) return [] as MatchWithContext[];
      if (isOrg) {
        const org = await fetchOwnOrganization(userId);
        return org ? listMatchesForOrganization(org.id) : [];
      }
      return listMatchesForOwner(userId);
    },
    [isOrg, userId]
  );

  const { data, loading, error, reload } = useAsync(loader, [loader]);
  const rows = data ?? [];
  const primary = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  const alternatives = rows.filter((r) => r.id !== primary?.id);

  const onAccept = async (row: MatchWithContext, quantity: number) => {
    if (!row.requirement || !row.item) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await allocateToRequirement({
        itemId: row.item.id,
        requirementId: row.requirement.id,
        quantity,
        matchId: row.id,
      });
      setNotice(
        `${quantity} committed to ${row.requirement.organization?.name ?? "the organization"}. They confirm the handoff to complete it.`
      );
      setSelectedId(null);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not commit this contribution.");
    } finally {
      setBusyId(null);
    }
  };

  const onDecline = async (row: MatchWithContext) => {
    setBusyId(row.id);
    setActionError(null);
    try {
      await setMatchStatus(row.id, "declined");
      setSelectedId(null);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not update this match.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>{isOrg ? "Incoming supply" : "Where this can go"}</StatusBadge>

      {notice ? (
        <p className="mt-6 rounded-[18px] border border-lime-300/20 bg-lime-300/8 px-4 py-3 text-sm text-lime-100">
          {notice}
        </p>
      ) : null}
      {actionError ? <div className="mt-6"><ErrorState message={actionError} /></div> : null}

      <div className="mt-6 space-y-6">
        {loading ? <LoadingState label="Ranking destinations" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            message={isOrg ? "No incoming contributions yet." : "Scan an item and ReHome will find where it should go."}
          />
        ) : null}

        {primary ? (
          <PrimaryMatch
            key={primary.id}
            row={primary}
            onAccept={onAccept}
            onDecline={onDecline}
            busy={busyId === primary.id}
          />
        ) : null}

        {alternatives.length > 0 ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/30">
              Other destinations considered
            </p>
            <div className="mt-1">
              {alternatives.map((row) => (
                <AlternativeRow key={row.id} row={row} onSelect={() => setSelectedId(row.id)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
