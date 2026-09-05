import { Camera, Search, Handshake, Award } from "lucide-react";
import { PremiumCard, SectionHeading } from "@/components/system/primitives";

const steps = [
  {
    number: "01",
    icon: Camera,
    title: "Capture",
    description: "Photograph any unused household item. Intake is designed to stay lightweight and private.",
  },
  {
    number: "02",
    icon: Search,
    title: "Understand",
    description: "Intelligence structures category, condition, and the most valuable next use.",
  },
  {
    number: "03",
    icon: Handshake,
    title: "Match",
    description: "Verified schools, shelters, charities, and recyclers receive what they actually need.",
  },
  {
    number: "04",
    icon: Award,
    title: "Measure",
    description: "Completed rehomes earn points and a private impact record you can stand behind.",
  },
];

export const HowItWorks = () => (
  <section id="how-it-works" className="relative py-20 md:py-28 overflow-hidden bg-[#10161d] text-white">
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="blob-float absolute bottom-0 left-[-80px] w-[400px] h-[400px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(163,230,53,0.08) 0%, transparent 70%)" }}
      />
    </div>
    <div className="relative max-w-6xl mx-auto px-4">
      <SectionHeading
        inverted
        eyebrow="The ReHome story"
        title="From object to"
        highlight="destination"
        subtitle="A four-beat ritual — capture, understand, match, measure — instead of a pile of generic product cards."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <PremiumCard key={step.number} className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Icon className="w-5 h-5 text-lime-300" />
                <span className="font-display text-2xl font-extrabold text-white/20">{step.number}</span>
              </div>
              <h3 className="font-display font-semibold text-lg">{step.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{step.description}</p>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  </section>
);
