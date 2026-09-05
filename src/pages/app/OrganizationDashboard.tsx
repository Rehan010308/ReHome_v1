import { Link } from "react-router-dom";
import { ArrowRight, Building2, Inbox } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listOrgRequirements } from "@/lib/data/catalog";
import { listMatchesForOrganization } from "@/lib/data/matches";
import {
  AnimatedBackground,
  DashboardCard,
  DataPanel,
  GlowButton,
  StatusBadge,
} from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

export default function OrganizationDashboard() {
  const { profile } = useAuth();
  const orgQuery = useAsync(async () => (profile ? fetchOwnOrganization(profile.userId) : null), [profile?.userId]);
  const org = orgQuery.data;
  const reqQuery = useAsync(async () => (org ? listOrgRequirements(org.id) : []), [org?.id]);
  const matchQuery = useAsync(async () => (org ? listMatchesForOrganization(org.id) : []), [org?.id]);

  const requirements = reqQuery.data ?? [];
  const matches = matchQuery.data ?? [];
  const openCount = requirements.filter((row) => row.status === "open").length;

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        <StatusBadge>Organization command center</StatusBadge>
        <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight">
          {org?.name ?? profile?.name}
        </h1>
        <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
          Publish what your community needs. Incoming items are scored against those requirements.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DataPanel label="Active requirements" value={String(openCount)} hint={`${requirements.length} total on the board`} />
          <DataPanel label="Incoming matches" value={String(matches.length)} hint="Scored against your demand" />
          <DataPanel
            label="Verification"
            value={org?.verification_status ?? "—"}
            hint="Trust status is not self-assigned"
          />
          <DataPanel label="Location" value={org?.location?.trim() || profile?.location?.trim() || "—"} hint="Used in match proximity" />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashboardCard
            title="Organization information"
            description="Persisted organization row linked to your profile."
            action={
              <Link to="/app/profile" className="text-xs uppercase tracking-[0.16em] text-lime-200">
                Edit
              </Link>
            }
          >
            {orgQuery.loading ? <LoadingState label="Loading organization" /> : null}
            {orgQuery.error ? <ErrorState message={orgQuery.error} /> : null}
            {org ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/8 pb-2">
                  <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Name</dt>
                  <dd>{org.name}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/8 pb-2">
                  <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Email</dt>
                  <dd>{org.contact_email ?? profile?.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Type</dt>
                  <dd className="inline-flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-lime-300" />
                    {org.org_type}
                  </dd>
                </div>
              </dl>
            ) : null}
          </DashboardCard>

          <DashboardCard
            title="Resource requirements"
            description="Live demand records. Matching uses category, type, condition, urgency, and location."
            action={
              <Link to="/app/requirements">
                <GlowButton>
                  Open board
                  <ArrowRight className="h-4 w-4" />
                </GlowButton>
              </Link>
            }
          >
            {reqQuery.loading ? <LoadingState label="Loading requirements" /> : null}
            {reqQuery.error ? <ErrorState message={reqQuery.error} /> : null}
            {!reqQuery.loading && requirements.length === 0 ? (
              <EmptyState message="No requirements yet — add what you need." />
            ) : null}
            <ul className="space-y-2">
              {requirements.slice(0, 4).map((row) => (
                <li key={row.id} className="flex justify-between gap-3 text-sm border-b border-white/8 pb-2">
                  <span>
                    {row.item_type}
                    <span className="ml-2 text-white/40">{row.quantity_received}/{row.quantity_requested}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-lime-200/80">{row.urgency}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          <DashboardCard
            title="Incoming matches"
            description="Household supply scored against your open requirements."
            action={
              <Link to="/app/matches">
                <GlowButton variant="ghost">
                  Review
                  <ArrowRight className="h-4 w-4" />
                </GlowButton>
              </Link>
            }
          >
            {matchQuery.loading ? <LoadingState label="Loading matches" /> : null}
            {matchQuery.error ? <ErrorState message={matchQuery.error} /> : null}
            {!matchQuery.loading && matches.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-white/50">
                <Inbox className="h-4 w-4 text-lime-300" />
                No incoming matches yet.
              </div>
            ) : null}
            {matches[0] ? (
              <p className="text-sm text-white/60">
                Top {Math.round(Number(matches[0].match_score))}% · {matches[0].item?.item_type}
              </p>
            ) : null}
          </DashboardCard>

          <DashboardCard title="Received items" description="Confirmed deliveries belong to a later handoff phase.">
            <p className="text-sm text-white/50">
              Matches can be accepted now. Impact is not claimed until a handoff is confirmed.
            </p>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
