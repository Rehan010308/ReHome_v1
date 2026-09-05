import { School, HeartHandshake, Recycle, Building2, MapPin } from "lucide-react";
import { PremiumCard, SectionHeading } from "@/components/system/primitives";

const partners = [
  {
    icon: School,
    name: "Bright Futures School",
    type: "Government School",
    wants: "Textbooks, stationery, bags",
    location: "2 km",
  },
  {
    icon: HeartHandshake,
    name: "Sunrise Children's Home",
    type: "Shelter",
    wants: "Clothing, toys, bedding",
    location: "4 km",
  },
  {
    icon: Recycle,
    name: "GreenCycle Hub",
    type: "Recycling Centre",
    wants: "E-waste, electronics",
    location: "6 km",
  },
  {
    icon: Building2,
    name: "City Food Bank",
    type: "Community Kitchen",
    wants: "Utensils, kitchenware",
    location: "8 km",
  },
];

export const LocalPartners = () => (
  <section id="partners" className="relative py-20 md:py-28 overflow-hidden bg-[#f3efe6] text-[#0c1218]">
    <div className="relative max-w-6xl mx-auto px-4">
      <SectionHeading
        eyebrow="Local partners"
        title="Verified destinations"
        highlight="near you"
        subtitle="Placeholder organizations illustrate routing. Live partner records arrive with persistence in Phase 3."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {partners.map((p) => {
          const Icon = p.icon;
          return (
            <PremiumCard key={p.name} className="p-6 flex flex-col gap-4 !bg-[#fffaf3] !border-[#0c1218]/8 shadow-[0_20px_50px_-28px_rgba(12,18,24,0.35)]">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#0c1218] text-lime-300 grid place-items-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-800/70">Verified</span>
              </div>
              <div>
                <h3 className="font-display font-semibold">{p.name}</h3>
                <p className="text-xs text-[#0c1218]/50 mt-0.5">{p.type}</p>
              </div>
              <p className="text-sm text-[#0c1218]/65 leading-relaxed">Needs {p.wants}</p>
              <p className="inline-flex items-center gap-1.5 text-xs text-[#0c1218]/50">
                <MapPin className="w-3.5 h-3.5" />
                {p.location}
              </p>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  </section>
);
