import { PackageCheck, Recycle, TrendingUp, Users } from "lucide-react";
import { PremiumCard, SectionHeading } from "@/components/system/primitives";

const stats = [
  { icon: PackageCheck, label: "Items rehomed", value: "0", note: "Every completed donation counts" },
  { icon: Recycle, label: "Waste avoided", value: "0 kg", note: "Tracked against disposal baselines" },
  { icon: TrendingUp, label: "Impact score", value: "—", note: "Your private sustainability index" },
  { icon: Users, label: "Organizations supported", value: "0", note: "Schools, shelters, recyclers" },
];

export const PersonalImpact = () => (
  <section id="impact" className="relative py-20 md:py-28 overflow-hidden bg-[#f3efe6] text-[#0c1218]">
    <div className="relative max-w-6xl mx-auto px-4">
      <SectionHeading
        eyebrow="Personal impact"
        title="A private record of"
        highlight="what you moved"
        subtitle="Preview metrics. Live numbers attach to your account once donations persist."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <PremiumCard
              key={s.label}
              className="p-6 flex flex-col gap-4 !bg-[#fffaf3] !border-[#0c1218]/8 shadow-[0_20px_50px_-28px_rgba(12,18,24,0.35)]"
            >
              <Icon className="w-5 h-5 text-emerald-800" />
              <div>
                <p className="font-display text-3xl font-bold">{s.value}</p>
                <p className="font-display font-semibold mt-1">{s.label}</p>
              </div>
              <p className="text-sm text-[#0c1218]/55 leading-relaxed">{s.note}</p>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  </section>
);
