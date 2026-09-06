import { Link } from "react-router-dom";
import { ArrowRight, Plus, ScanLine, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listOrgRequirements } from "@/lib/data/catalog";
import { listOrganizationAllocations } from "@/lib/data/allocations";
import { AnimatedBackground } from "@/components/system/primitives";
import { FulfillmentMeter } from "@/components/system/FulfillmentMeter";
import { QrCode } from "@/components/system/QrCode";
import { organizationUrl } from "@/services/handoff/codes";
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
  const confirmed = allocations.filter((a) => a.status === "confirmed");
  const unitsReceived = confirmed.reduce((sum, a) => sum + a.quantity_allocated, 0);
  const contributors = new Set(confirmed.map((a) => a.donor_id)).size;
  // The only thing that needs the organization's attention right now.
  const awaitingConfirmation = allocations.filter(
    (a) => a.status === "handed_over" || a.status === "handoff_scheduled"
  );

  return (
    <div className="relative">
      <AnimatedBackground />

      <div className="relative mx-auto max-w-3xl px-4 py-12 md:py-20">
        <p className="rh-mono inline-flex items-center gap-2 text-[10px] tracking-[0.3em] text-lime-200/70">
          {org?.verification_status === "verified" ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              VERIFIED ORGANIZATION
            </>
          ) : (
            "ORGANIZATION"
          )}
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

          <Link
            to="/app/verify"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/12 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white/75 transition-colors hover:border-white/30 hover:text-white"
          >
            <ScanLine className="h-4 w-4" />
            Scan a handoff
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

        {/* ── WHAT ACTUALLY ARRIVED ──────────────────────────────────
            Confirmed receipts only. A committed allocation is a promise, and
            counting promises as arrivals is how a fulfilment number starts
            lying. */}
        <div className="mt-16">
          <h2 className="font-display text-lg font-semibold">Received and in use</h2>
          <div className="mt-4">
            {allocQuery.loading ? <LoadingState label="Loading contributions" /> : null}
            {allocQuery.error ? <ErrorState message={allocQuery.error} /> : null}
            {!allocQuery.loading && confirmed.length === 0 ? (
              <p className="border-t border-white/6 pt-6 text-sm leading-relaxed text-white/35">
                Nothing confirmed received yet. Scan a donor's handoff code to confirm what
                actually arrives.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-12 gap-y-4 border-t border-white/6 pt-6">
                  <div>
                    <p className="font-display text-[2.2rem] font-bold leading-none text-lime-200">
                      {unitsReceived}
                    </p>
                    <p className="mt-2 text-[13px] text-white/45">units received</p>
                  </div>
                  <div>
                    <p className="font-display text-[1.6rem] font-semibold leading-none text-white/85">
                      {confirmed.length}
                    </p>
                    <p className="mt-2 text-[13px] text-white/45">completed handoffs</p>
                  </div>
                  <div>
                    <p className="font-display text-[1.6rem] font-semibold leading-none text-white/85">
                      {contributors}
                    </p>
                    <p className="mt-2 text-[13px] text-white/45">
                      {contributors === 1 ? "contributor" : "contributors"}
                    </p>
                  </div>
                </div>

                <ul className="mt-7 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {confirmed.slice(0, 8).map((row) => (
                    <li key={row.id} className="flex items-center gap-4 py-3.5">
                      <span className="min-w-0 flex-1 truncate text-[15px] text-white/85">
                        {row.item?.item_type ?? "Item"}
                        <span className="ml-2 text-white/35">×{row.quantity_allocated}</span>
                      </span>
                      <span className="shrink-0 text-[13px] text-white/35">
                        for {row.requirement?.item_type}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── DESTINATION CODE ───────────────────────────────────────── */}
        {org ? (
          <div className="mt-16 flex flex-wrap items-center gap-7 border-t border-white/[0.07] pt-9">
            <QrCode
              value={organizationUrl(org.id)}
              size={132}
              label={`ReHome destination code for ${org.name}`}
            />
            <div className="min-w-0">
              <p className="rh-mono text-[10px] tracking-[0.24em] text-white/35">
                REHOME DESTINATION CODE
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/40">
                Print this at your collection point. A donor scanning it sees who you are, your
                verification status and what you currently accept — before they travel.
              </p>
              <Link
                to={`/app/destination/${org.id}`}
                className="mt-3 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
              >
                Preview the page it opens
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
