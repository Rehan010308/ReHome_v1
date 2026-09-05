import { useMemo, useState } from "react";
import { Check, MapPin, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listMatchesForOrganization, listMatchesForOwner, setMatchStatus } from "@/lib/data/matches";
import { allocateToRequirement } from "@/lib/data/allocations";
import type { MatchWithContext } from "@/types/database";
import type { MatchFactor } from "@/services/matching/engine";
import { formatDistance } from "@/services/geo";
import { GlowButton } from "@/components/system/primitives";
import { FulfillmentMeter } from "@/components/system/FulfillmentMeter";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

function factorsOf(row: MatchWithContext): MatchFactor[] {
  return (row.matching_factors as unknown as MatchFactor[]) ?? [];
}

/**
 * Donors must never see an organization's operational demand figures — how
 * many were requested, how many remain, how many other people contributed.
 * The scoring engine writes some of those numbers into its own factor text, so
 * they are stripped here rather than rendered and hoped over.
 */
const LEAKS_DEMAND = /\b\d+\s*(of|still needed|remaining|more)\b|covers the remaining|contributes\s+\d/i;

function donorSafeFactors(factors: MatchFactor[]): MatchFactor[] {
  return factors.filter((f) => !LEAKS_DEMAND.test(f.label));
}

/** Demand expressed as pressure, not as arithmetic. */
const DEMAND_PHRASE: Record<string, string> = {
  critical: "Urgently needed",
  high: "High-priority need",
  medium: "Currently needed",
  low: "Wanted",
};

function DestinationDecision({
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

  const remaining = Math.max(0, (req?.quantity_requested ?? 0) - (req?.quantity_received ?? 0));
  const available = item?.quantity_available ?? item?.quantity ?? 1;
  const maxContribution = Math.max(1, Math.min(available, remaining));
  const [quantity, setQuantity] = useState(maxContribution);

  const factors = donorSafeFactors(factorsOf(row));
  const positives = factors.filter((f) => f.kind === "positive");
  const cautions = factors.filter((f) => f.kind === "caution");
  const distance = formatDistance(row.distance_km);
  const verified = org?.verification_status === "verified";

  return (
    <section
      className="relative overflow-hidden rounded-[26px] border border-white/[0.08]"
      style={{
        background: "linear-gradient(180deg, rgba(10,19,25,0.95), rgba(6,11,16,0.9))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 100px -50px rgba(0,0,0,0.9)",
      }}
    >
      <div className="p-6 md:p-9">
        <p className="text-[13px] text-lime-300/80">ReHome found a destination</p>

        <h2 className="mt-3 font-display text-[clamp(1.7rem,4vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.02em]">
          {org?.name ?? "Organization"}
        </h2>

        <p className="mt-2 text-[15px] text-white/55">{req?.item_type}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {distance ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/65">
              <MapPin className="h-3 w-3 text-lime-300/70" />
              {distance}
            </span>
          ) : null}
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.07] px-3 py-1.5 text-[12px] text-lime-100">
              <ShieldCheck className="h-3 w-3" />
              Verified organization
            </span>
          ) : null}
          {req?.urgency ? (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/65">
              {DEMAND_PHRASE[req.urgency] ?? "Currently needed"}
            </span>
          ) : null}
          {org?.is_directory ? (
            <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/30">
              Seeded demo organization
            </span>
          ) : null}
        </div>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-white/[0.09] to-transparent" />

        <p className="mt-7 text-[13px] text-white/40">Why ReHome recommends this</p>
        <ul className="mt-4 space-y-2.5">
          {positives.slice(0, 5).map((f) => (
            <li key={f.label} className="flex items-start gap-3 text-[15px] text-white/75">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-300" />
              {f.label}
            </li>
          ))}
          {cautions.map((f) => (
            <li key={f.label} className="flex items-start gap-3 text-[15px] text-amber-100/70">
              <span className="mt-0.5 w-3.5 shrink-0 text-center text-amber-300">!</span>
              {f.label}
            </li>
          ))}
        </ul>

        {/* The donor's own contribution — never the aggregate it joins. */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-5 rounded-[18px] border border-white/[0.07] bg-white/[0.02] px-5 py-5">
          <div>
            <p className="text-[13px] text-white/40">Your contribution</p>
            <p className="mt-1.5 font-display text-2xl font-semibold text-lime-200">
              {quantity} {item?.item_type ?? "item"}
              {quantity > 1 ? "s" : ""}
            </p>
          </div>
          {maxContribution > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Contribute one fewer"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-full border border-white/12 text-lg text-white/70 transition-colors hover:bg-white/5 disabled:opacity-25"
              >−</button>
              <button
                type="button"
                aria-label="Contribute one more"
                disabled={quantity >= maxContribution}
                onClick={() => setQuantity((q) => Math.min(maxContribution, q + 1))}
                className="h-10 w-10 rounded-full border border-white/12 text-lg text-white/70 transition-colors hover:bg-white/5 disabled:opacity-25"
              >+</button>
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <GlowButton disabled={busy} onClick={() => onAccept(row, quantity)} className="sm:flex-1">
            {busy ? "Confirming…" : "Confirm destination"}
          </GlowButton>
          <GlowButton variant="ghost" disabled={busy} onClick={() => onDecline(row)}>
            Not a fit
          </GlowButton>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-white/30">
          Confirming reserves your contribution. It counts as rehomed once {org?.name ?? "the organization"} confirms
          the handoff.
        </p>
      </div>
    </section>
  );
}

/** Organizations keep their full operational picture. */
function OrgMatchRow({ row }: { row: MatchWithContext }) {
  const req = row.requirement;
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[15px] text-white/90">
          {row.item?.item_type ?? "Item"}
          <span className="ml-2 text-white/35">for {req?.item_type}</span>
        </p>
        <span className="font-display text-sm font-semibold text-lime-200">
          {Math.round(Number(row.match_score))}%
        </span>
      </div>
      {req ? (
        <div className="mt-3">
          <FulfillmentMeter
            requested={req.quantity_requested}
            received={req.quantity_received}
          />
        </div>
      ) : null}
    </li>
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
        `Destination confirmed. Arrange the handoff with ${row.requirement.organization?.name ?? "the organization"}.`
      );
      setSelectedId(null);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not confirm this destination.");
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
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{ background: "radial-gradient(70% 50% at 50% 0%, rgba(30,92,70,0.22), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-24 pt-14">
        <h1 className="font-display text-[clamp(1.8rem,4.5vw,2.6rem)] font-bold leading-tight tracking-[-0.02em]">
          {isOrg ? "Incoming supply" : "Destinations"}
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/45">
          {isOrg
            ? "Donations scored against what you have published, with live fulfillment."
            : "Where your items can go next, and why ReHome chose each one."}
        </p>

        {notice ? (
          <p className="mt-7 rounded-[18px] border border-lime-300/20 bg-lime-300/[0.07] px-5 py-4 text-[15px] text-lime-100">
            {notice}
          </p>
        ) : null}
        {actionError ? <div className="mt-7"><ErrorState message={actionError} /></div> : null}

        <div className="mt-9 space-y-7">
          {loading ? <LoadingState label="Ranking destinations" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {!loading && !error && rows.length === 0 ? (
            <EmptyState
              message={
                isOrg
                  ? "No incoming contributions yet."
                  : "Scan an item and ReHome will find where it belongs."
              }
            />
          ) : null}

          {isOrg ? (
            rows.length > 0 ? (
              <ul className="divide-y divide-white/[0.06]">
                {rows.map((row) => <OrgMatchRow key={row.id} row={row} />)}
              </ul>
            ) : null
          ) : (
            <>
              {primary ? (
                <DestinationDecision
                  key={primary.id}
                  row={primary}
                  onAccept={onAccept}
                  onDecline={onDecline}
                  busy={busyId === primary.id}
                />
              ) : null}

              {alternatives.length > 0 ? (
                <div>
                  <p className="text-[13px] text-white/35">Other destinations considered</p>
                  <ul className="mt-2 divide-y divide-white/[0.06]">
                    {alternatives.map((row) => {
                      const distance = formatDistance(row.distance_km);
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className="flex w-full items-center justify-between gap-4 py-4 text-left transition-opacity hover:opacity-100 opacity-70"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] text-white/85">
                                {row.requirement?.organization?.name ?? "Organization"}
                              </span>
                              <span className="block truncate text-[13px] text-white/30">
                                {row.requirement?.item_type}
                                {distance ? ` — ${distance}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-[13px] text-white/40">View</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
