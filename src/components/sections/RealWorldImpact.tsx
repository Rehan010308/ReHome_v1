import { Leaf, Users, Recycle, TrendingUp } from "lucide-react";
import { PremiumCard, SectionHeading } from "@/components/system/primitives";

const benefits = [
  {
    icon: Leaf,
    title: "Less landfill",
    description: "Every rehomed object is one less disposal event, measured against real baselines.",
  },
  {
    icon: Users,
    title: "Community load",
    description: "Demand from schools, shelters, and kitchens is the routing target — not a generic feed.",
  },
  {
    icon: Recycle,
    title: "Material recovery",
    description: "When reuse is impossible, certified recyclers recover what still has value.",
  },
  {
    icon: TrendingUp,
    title: "Traceable progress",
    description: "Impact updates after completed transfers, not after a photo is taken.",
  },
];

export const RealWorldImpact = () => (
  <section id="real-world-impact" className="relative py-20 md:py-28 overflow-hidden bg-[#10161d] text-white">
    <div className="relative max-w-6xl mx-auto px-4">
      <SectionHeading
        inverted
        eyebrow="Real-world impact"
        title="Routing that"
        highlight="actually lands"
        subtitle="The product story is destination, not donation theatre."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {benefits.map((b) => {
          const Icon = b.icon;
          return (
            <PremiumCard key={b.title} className="p-6 flex flex-col gap-4">
              <Icon className="w-5 h-5 text-lime-300" />
              <div className="h-px w-10 bg-gradient-to-r from-lime-300 to-transparent" />
              <h3 className="font-display font-semibold">{b.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{b.description}</p>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  </section>
);
