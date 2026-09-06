import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchAllocationById } from "@/lib/data/allocations";
import { fetchImpactSummary } from "@/lib/data/impact";
import { QrCode } from "@/components/system/QrCode";
import { handoffReference, impactReceiptUrl } from "@/services/handoff/codes";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * The receipt for one confirmed contribution.
 *
 * It exists only for allocations that actually reached `confirmed`, and every
 * figure on it is read back from the impact record the database wrote — not
 * from the size of the requirement, and not from anything the donor asserted.
 * If no impact record exists, the page says so rather than printing a receipt
 * for something that has not happened.
 */
export default function ImpactReceipt() {
  const { allocationId } = useParams<{ allocationId: string }>();
  const { profile } = useAuth();

  const loader = useMemo(
    () => async () => {
      if (!allocationId || !profile?.userId) return null;
      const [allocation, impact] = await Promise.all([
        fetchAllocationById(allocationId),
        fetchImpactSummary(profile.userId),
      ]);
      const record = impact.records.find((r) => r.allocation_id === allocationId) ?? null;
      return { allocation, record };
    },
    [allocationId, profile?.userId]
  );

  const { data, loading, error } = useAsync(loader, [loader]);
  const allocation = data?.allocation ?? null;
  const record = data?.record ?? null;
  const org = allocation?.requirement?.organization;
  const item = allocation?.item;

  return (
    <div className="relative mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">IMPACT RECEIPT</p>

      {loading ? <div className="mt-8"><LoadingState label="Reading the record" /></div> : null}
      {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}

      {!loading && !error && !record ? (
        <div className="mt-8">
          <EmptyState message="No confirmed impact record for this handoff yet. A receipt exists only once the organization has confirmed receipt." />
          <Link
            to="/app/handoffs"
            className="mt-6 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
          >
            Back to handoffs
          </Link>
        </div>
      ) : null}

      {record ? (
        <>
          <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-lime-300/90">
            <Sparkles className="h-3.5 w-3.5" />
            Your item has officially found its second life.
          </p>

          <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
            {record.quantity} {item?.item_type ?? String(record.metrics?.item_type ?? "item")}
            {record.quantity > 1 ? "s" : ""}
            <span className="block text-white/40">
              received by {org?.name ?? "a ReHome destination"}.
            </span>
          </h1>

          <dl className="rh-inset mt-9 rounded-[20px] px-6 py-5">
            {[
              ["Reference", handoffReference(record.allocation_id ?? "")],
              ["Destination path", record.destination_tier ?? "—"],
              ["Quantity confirmed", String(record.quantity)],
              ["Impact points", String(record.points)],
              ["Confirmed", new Date(record.created_at).toLocaleDateString(undefined, {
                day: "numeric", month: "long", year: "numeric",
              })],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`flex justify-between gap-6 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
              >
                <dt className="text-[15px] text-white/35">{k}</dt>
                <dd className="text-right text-[15px] text-white/85">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap items-center gap-7">
            <QrCode
              value={impactReceiptUrl(record.allocation_id ?? "")}
              size={140}
              label="Impact receipt code"
            />
            <div className="min-w-0">
              <p className="rh-mono text-[10px] tracking-[0.22em] text-white/35">VERIFY THIS RECEIPT</p>
              <p className="mt-2 max-w-[15rem] text-[13px] leading-relaxed text-white/40">
                The code points at this record. It carries no personal data — a reader still has to
                be entitled to the record before anything is shown.
              </p>
            </div>
          </div>

          <Link
            to="/app/impact"
            className="mt-10 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
          >
            See your impact
          </Link>
        </>
      ) : null}
    </div>
  );
}
