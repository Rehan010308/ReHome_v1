import { Link } from "react-router-dom";
import { ArrowRight, Building2, Inbox, PackageCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  AnimatedBackground,
  DashboardCard,
  DataPanel,
  GlowButton,
  StatusBadge,
} from "@/components/system/primitives";

export default function OrganizationDashboard() {
  const { profile } = useAuth();

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        <StatusBadge>Organization command center</StatusBadge>
        <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight">{profile?.name}</h1>
        <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
          Publish what your community needs. Incoming matches and received items will land here
          once the matching engine ships.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DataPanel label="Active requirements" value="—" hint="Schema arrives in Phase 3" />
          <DataPanel label="Incoming matches" value="0" hint="No matches yet" />
          <DataPanel label="Received items" value="0" hint="Awaiting first transfer" />
          <DataPanel label="Community impact" value="—" hint="Tracked after collections" />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashboardCard
            title="Organization information"
            description="Name and account identity are live. Extended org records belong to Phase 3."
          >
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/8 pb-2">
                <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Name</dt>
                <dd>{profile?.name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/8 pb-2">
                <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Email</dt>
                <dd>{profile?.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/40 uppercase tracking-[0.18em] text-[10px]">Type</dt>
                <dd className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-lime-300" />
                  Organization
                </dd>
              </div>
            </dl>
          </DashboardCard>

          <DashboardCard
            title="Resource requirements"
            description="List textbooks, clothing, shelter supplies, and other needs."
            action={
              <Link to="/app/requirements">
                <GlowButton>
                  Open board
                  <ArrowRight className="h-4 w-4" />
                </GlowButton>
              </Link>
            }
          />

          <DashboardCard title="Incoming matches" description="Ranked item → requirement pairs will appear here.">
            <div className="flex items-center gap-3 text-sm text-white/50">
              <Inbox className="h-4 w-4 text-lime-300" />
              Matching is not active in Phase 2.
            </div>
          </DashboardCard>

          <DashboardCard title="Received items" description="Confirmed deliveries and impact attribution.">
            <div className="flex items-center gap-3 text-sm text-white/50">
              <PackageCheck className="h-4 w-4 text-lime-300" />
              Empty until persistence ships.
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
