import { Link } from "react-router-dom";
import { ArrowRight, Camera, HeartHandshake, Package, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  AnimatedBackground,
  DashboardCard,
  DataPanel,
  GlowButton,
  StatusBadge,
} from "@/components/system/primitives";

const stages = ["Object", "Scanning", "Understanding", "Structuring", "Matching", "Destination"];

export default function IndividualDashboard() {
  const { profile } = useAuth();

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        <StatusBadge>Individual command center</StatusBadge>
        <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight">
          Welcome back, {profile?.name.split(" ")[0]}
        </h1>
        <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
          This is the foundation of your rehoming workspace. Scanning, matches, and impact
          connect here in later phases — the structure is ready.
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
          <DataPanel label="Items analyzed" value="—" hint="Live counts arrive in Phase 3" />
          <DataPanel label="Rehoming activity" value="0" hint="No transfers yet" />
          <DataPanel label="Impact" value="—" hint="Waste avoided & people reached" />
          <DataPanel label="Points" value="0" hint="Rewards engine is later" />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashboardCard
            title="Scan an item"
            description="Photograph unused objects. Analysis and matching will plug into this flow without changing the layout."
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
              Camera and upload UI are ready. Computer vision is not enabled yet.
            </div>
          </DashboardCard>

          <DashboardCard
            title="Analyzed items"
            description="Structured item profiles will appear here after Phase 3 persistence."
          >
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
              No items yet — start with a scan when you are ready.
            </div>
          </DashboardCard>

          <DashboardCard
            title="Rehoming activity"
            description="Matches, pickups, and completed donations will stream into this panel."
          >
            <div className="flex items-center gap-3 text-sm text-white/50">
              <HeartHandshake className="h-4 w-4 text-lime-300" />
              Matching engine is deferred to a later phase.
            </div>
          </DashboardCard>

          <DashboardCard title="Impact preview" description="Personal footprint stays private to your account.">
            <div className="flex items-center gap-3 text-sm text-white/50">
              <Sparkles className="h-4 w-4 text-lime-300" />
              <Package className="h-4 w-4 text-lime-300" />
              Placeholder metrics until donations are stored.
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
