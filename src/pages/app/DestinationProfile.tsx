import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, ShieldCheck } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { fetchOrganizationById } from "@/lib/data/profiles";
import { listOrgRequirements } from "@/lib/data/catalog";
import { QrCode } from "@/components/system/QrCode";
import { organizationUrl } from "@/services/handoff/codes";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * A destination's ReHome profile — what an organization's own QR opens.
 *
 * Its purpose is trust before a journey: a donor standing in front of a
 * collection point can check that this really is a ReHome destination, see
 * whether it has been verified, and read what it actually accepts. Verification
 * status is printed exactly as the database holds it, including "not verified",
 * because a badge that is always green tells nobody anything.
 *
 * What it deliberately does not show: how many units are outstanding, who has
 * contributed, or any other operational demand figure.
 */
export default function DestinationProfile() {
  const { organizationId } = useParams<{ organizationId: string }>();

  const orgLoader = useMemo(
    () => async () => (organizationId ? fetchOrganizationById(organizationId) : null),
    [organizationId]
  );
  const { data: org, loading, error } = useAsync(orgLoader, [orgLoader]);

  const reqLoader = useMemo(
    () => async () => (org ? listOrgRequirements(org.id) : []),
    [org?.id]
  );
  const { data: requirements } = useAsync(reqLoader, [reqLoader]);

  const accepts = useMemo(() => {
    const open = (requirements ?? []).filter(
      (r) => r.status === "open" || r.status === "partially_fulfilled"
    );
    return [...new Set(open.map((r) => r.item_type))];
  }, [requirements]);

  const verified = org?.verification_status === "verified";

  return (
    <div className="relative mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">REHOME DESTINATION</p>

      {loading ? <div className="mt-8"><LoadingState label="Reading the destination" /></div> : null}
      {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}
      {!loading && !error && !org ? (
        <div className="mt-8"><EmptyState message="No destination matches that code." /></div>
      ) : null}

      {org ? (
        <>
          <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
            {org.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] ${
                verified
                  ? "border border-lime-300/25 bg-lime-300/[0.07] text-lime-100"
                  : "border border-white/10 text-white/50"
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              {verified ? "Verified destination" : "Not yet verified"}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] capitalize text-white/60">
              {org.org_type.replace(/_/g, " ")}
            </span>
            {org.is_directory ? (
              <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/30">
                Seeded demo organization
              </span>
            ) : null}
          </div>

          {org.description ? (
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/55">
              {org.description}
            </p>
          ) : null}

          {org.location ? (
            <p className="mt-4 inline-flex items-center gap-2 text-[15px] text-white/50">
              <MapPin className="h-4 w-4 text-lime-300/70" />
              {org.location}
            </p>
          ) : null}

          <div className="mt-10">
            <p className="rh-mono text-[10px] tracking-[0.28em] text-white/35">CURRENTLY ACCEPTS</p>
            {accepts.length === 0 ? (
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/35">
                Nothing published right now. ReHome only routes items against demand an
                organization has actually stated.
              </p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {accepts.map((type) => (
                  <li
                    key={type}
                    className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-white/70"
                  >
                    {type}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-7 border-t border-white/[0.07] pt-9">
            <QrCode
              value={organizationUrl(org.id)}
              size={128}
              label={`ReHome destination code for ${org.name}`}
            />
            <div className="min-w-0">
              <p className="rh-mono text-[10px] tracking-[0.22em] text-white/35">DESTINATION CODE</p>
              <p className="mt-2 max-w-[15rem] text-[13px] leading-relaxed text-white/40">
                Print this at a collection point. Scanning it opens this page, so a donor can check
                the destination before travelling.
              </p>
            </div>
          </div>

          <Link
            to="/app/matches"
            className="mt-10 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
          >
            Back to destinations
          </Link>
        </>
      ) : null}
    </div>
  );
}
