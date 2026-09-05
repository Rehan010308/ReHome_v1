import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listOrgRequirements } from "@/lib/data/catalog";
import { listOrganizationAllocations } from "@/lib/data/allocations";
import { AnimatedBackground } from "@/components/system/primitives";
import { FulfillmentMeter } from "@/components/system/FulfillmentMeter";
import { ErrorState, LoadingState } from "@/components/system/DataState";

export default function OrganizationDashboard() {
  const { profile } = useAuth();
  const userId = profile?.userId;

  const orgQuery = useAsync(async () => (userId ? fetchOwnOrganization(userId) : null), [userId]);
  const org = orgQuery.data;
  const reqQuery = useAsync(async () => (org ? listOrgRequirements(org.id) : []), [org?.id]);
  const allocQuery = useAsync(async () => (org ? listOrganizationAllocations(org.id) : []), [org?.id]);

  const requirements = reqQuery.data ?? [];
  const allocations = allocQuery.data ?? [];

  const live = requirements.filter((r) => r.status === "open" || r.status === "partially_fulfilled");
  // The only thing that needs the organization's attention right now.
  const awaitingConfirmation = allocations.filter(
    (a) => a.status === "handed_over" || a.status === "handoff_scheduled"
  );

  return (
    <div className="relative">
      <AnimatedBackground />

      <div className="relative mx-auto max-w-3xl px-4 py-12 md:py-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-lime-200/70">
          {org?.verification_status === "verified" ? "Verified organization" : "Organization"}
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-[1.03] tracking-tight">
          {org?.name ?? profile?.name}
        </h1>
        <p className="mt-5 max-w-lg leading-relaxed text-white/55">
          Publish what your community needs. Donations are scored against it, and contributions
          from many people add up against the same requirement.
        </p>

        {orgQuery.loading ? <div className="mt-8"><LoadingState label="Loading organization" /></div> : null}
        {orgQuery.error ? <div className="mt-8"><ErrorState message={orgQuery.error} /></div> : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/app/requirements"
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#06231a] shadow-[0_0_40px_rgba(163,230,53,0.28)] transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Post what you need
          </Link>

          {awaitingConfirmation.length > 0 ? (
            <Link
              to="/app/handoffs"
              className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/8 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-lime-100"
            >
              {awaitingConfirmation.length} awaiting you
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {/* CURRENT STATE — demand, with real fulfillment. */}
        <div className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Open requirements</h2>
            {requirements.length > 0 ? (
              <Link to="/app/requirements" className="text-xs uppercase tracking-[0.16em] text-lime-200/80 hover:text-lime-200">
                Manage
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            {reqQuery.loading ? <LoadingState label="Loading requirements" /> : null}
            {reqQuery.error ? <ErrorState message={reqQuery.error} /> : null}

            {!reqQuery.loading && live.length === 0 ? (
              <p className="border-t border-white/6 pt-6 text-sm leading-relaxed text-white/35">
                Nothing published yet. Donations can only be matched against stated demand.
              </p>
            ) : (
              <div className="border-t border-white/6">
                {live.slice(0, 5).map((row) => (
                  <div key={row.id} className="border-b border-white/6 py-5 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="truncate text-sm font-medium text-white/85">{row.item_type}</p>
                      {row.urgency === "high" || row.urgency === "critical" ? (
                        <span className="shrink-0 text-xs text-lime-200/80">{row.urgency}</span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <FulfillmentMeter
                        requested={row.quantity_requested}
                        received={row.quantity_received}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
