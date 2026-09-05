import { Coins, Flame, Target, Gift } from "lucide-react";
import { PremiumCard, SectionHeading } from "@/components/system/primitives";

const bonuses = [
  { icon: Coins, title: "Category bonuses", description: "Higher-value and e-waste streams earn more — reuse is rewarded." },
  { icon: Flame, title: "Streaks", description: "Consecutive weeks of rehoming unlock momentum multipliers." },
  { icon: Target, title: "Milestones", description: "10, 25, and 50 completed donations mark the path." },
  { icon: Gift, title: "Redemption", description: "Partner rewards arrive with the later rewards engine." },
];

const pointTable = [
  { category: "Books", range: "10–15" },
  { category: "Clothing", range: "5–10" },
  { category: "Electronics", range: "20–30" },
  { category: "Furniture", range: "15–25" },
  { category: "E-waste", range: "30–45" },
];

export const RewardPoints = () => (
  <section id="rewards" className="relative py-20 md:py-28 overflow-hidden bg-[#0c1218] text-white">
    <div className="relative max-w-6xl mx-auto px-4">
      <SectionHeading
        inverted
        eyebrow="Reward points"
        title="Good routing earns"
        highlight="real credit"
        subtitle="Indicative ranges only — final values ship with the rewards engine."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {bonuses.map((b) => {
          const Icon = b.icon;
          return (
            <PremiumCard key={b.title} className="p-6 flex flex-col gap-4">
              <Icon className="w-5 h-5 text-lime-300" />
              <h3 className="font-display font-semibold">{b.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{b.description}</p>
            </PremiumCard>
          );
        })}
      </div>
      <PremiumCard className="mt-10 p-6 md:p-8 max-w-2xl mx-auto">
        <h3 className="font-display font-semibold mb-4">Points by category</h3>
        <div className="divide-y divide-white/8">
          {pointTable.map((row) => (
            <div key={row.category} className="flex items-center justify-between py-3">
              <span className="text-sm text-white/70">{row.category}</span>
              <span className="text-sm font-bold text-lime-300">{row.range} pts</span>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  </section>
);
