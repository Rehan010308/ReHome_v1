import { Hero } from "@/components/sections/Hero";
import { TransitionSection } from "@/components/system/TransitionSection";
import { ReVisionAI } from "@/components/sections/ReVisionAI";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { LocalPartners } from "@/components/sections/LocalPartners";
import { RewardPoints } from "@/components/sections/RewardPoints";
import { PersonalImpact } from "@/components/sections/PersonalImpact";
import { RealWorldImpact } from "@/components/sections/RealWorldImpact";
import { CTA } from "@/components/sections/CTA";

const Home = () => (
  <>
    <Hero />
    <TransitionSection />
    <ReVisionAI />
    <HowItWorks />
    <LocalPartners />
    <RewardPoints />
    <PersonalImpact />
    <RealWorldImpact />
    <CTA />
  </>
);

export default Home;
