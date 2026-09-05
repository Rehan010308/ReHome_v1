import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { scrollToSection } from "@/lib/scrollTo";

const HeroScene3D = lazy(() => import("./hero/HeroScene3D"));

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  // Subtle scene exit on scroll: the hero content translates and fades as
  // the reader moves into the page story.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const total = el.offsetHeight;
          const p = Math.min(Math.max(-rect.top / total, 0), 1);
          setProgress(p);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const eased = 1 - progress;
  const contentStyle = {
    opacity: Math.max(0, eased),
    transform: `translateY(${progress * 46}px)`,
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col overflow-hidden bg-[#050a10] text-white"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[620px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(38,120,84,0.34), transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -left-40 w-[520px] h-[520px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(22,80,64,0.28), transparent 70%)" }}
        />
        <div
          className="absolute top-1/4 -right-40 w-[560px] h-[560px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(140,220,90,0.12), transparent 70%)" }}
        />
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(190,255,220,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(190,255,220,0.6) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-28 md:pt-32 pb-8">
        <div style={contentStyle} className="w-full flex flex-col items-center">
          <p className="fade-in-up inline-flex items-center gap-3 text-[11px] md:text-xs tracking-[0.42em] uppercase text-lime-200/80 font-semibold">
            <span className="h-px w-8 md:w-12 bg-lime-300/40" />
            AI-Powered Resource Reallocation
            <span className="h-px w-8 md:w-12 bg-lime-300/40" />
          </p>

          <h1 className="fade-in-up delay-100 mt-6 md:mt-7 font-display font-bold uppercase leading-[0.98] tracking-tight text-balance">
            <span className="block text-[clamp(2.6rem,7.2vw,6.2rem)]">Give Your Items</span>
            <span className="block text-[clamp(2.6rem,7.2vw,6.2rem)] bg-gradient-to-r from-lime-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
              A Second Life
            </span>
          </h1>

          <p className="fade-in-up delay-200 mt-6 max-w-2xl mx-auto text-white/70 text-base md:text-lg leading-relaxed">
            ReHome uses AI to understand unused items and connect them with the
            people, organizations and places where they can create the most
            value next.
          </p>

          <div className="fade-in-up delay-300 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => scrollToSection("cta")}
              className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-8 md:px-10 py-4 text-sm md:text-base font-bold tracking-[0.14em] text-[#06231a] uppercase shadow-[0_0_44px_rgba(163,230,53,0.35)] hover:shadow-[0_0_64px_rgba(163,230,53,0.5)] hover:-translate-y-0.5 transition-all duration-300"
            >
              Start Rehoming
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 md:px-10 py-4 text-sm md:text-base font-semibold tracking-[0.14em] text-white/85 uppercase backdrop-blur-sm hover:bg-white/10 hover:border-white/35 transition-all duration-300"
            >
              Explore How It Works
            </button>
          </div>

          <p className="fade-in-up delay-400 mt-4 text-[11px] text-white/35 tracking-wide">
            Individual &amp; organization accounts arrive with Phase 2 — the
            flow below is a live product preview.
          </p>
        </div>

        {/* 3D intelligence stage */}
        <div
          className="fade-in-up delay-500 relative mt-8 md:mt-10 w-full max-w-6xl overflow-hidden rounded-[24px] md:rounded-[32px] border border-white/10 bg-[#071016] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(163,230,53,0.06)_inset] h-[340px] sm:h-[420px] lg:h-[520px]"
        >
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-full bg-lime-300/20 animate-pulse shadow-[0_0_60px_rgba(163,230,53,0.5)] grid place-items-center">
                    <div className="h-3 w-3 rounded-full bg-lime-300" />
                  </div>
                  <p className="text-[10px] tracking-[0.4em] uppercase text-lime-100/60">
                    Calibrating ReHome Intelligence
                  </p>
                </div>
              </div>
            }
          >
            <HeroScene3D />
          </Suspense>

          {/* Inner vignette for depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 120% 90% at 50% 100%, rgba(2,6,10,0.5), transparent 55%)",
            }}
          />
        </div>
      </div>
    </section>
  );
};

export { Hero };
export default Hero;