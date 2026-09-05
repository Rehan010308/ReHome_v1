import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export const CTA = () => (
  <section id="cta" className="relative py-20 md:py-24 px-4 bg-[#050a10] text-white">
    <div
      className="pointer-events-none absolute inset-0"
      style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(38,120,84,0.22), transparent 70%)" }}
    />
    <div className="relative max-w-4xl mx-auto text-center">
      <p className="text-[11px] tracking-[0.4em] uppercase text-lime-200/75 font-semibold">The next destination</p>
      <h2 className="mt-5 text-3xl md:text-5xl font-display font-bold tracking-tight leading-tight">
        Ready to give your items
        <span className="block bg-gradient-to-r from-lime-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
          a second life?
        </span>
      </h2>
      <p className="mt-5 text-white/65 max-w-xl mx-auto text-lg leading-relaxed">
        Create an Individual or Organization account and enter the command center.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-[#06231a] shadow-[0_0_44px_rgba(163,230,53,0.28)] hover:-translate-y-0.5 transition-transform"
        >
          Create account
          <ArrowRight className="w-4 h-4" />
        </Link>
        <a
          href="mailto:support@rehome.app"
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white/85 hover:bg-white/8"
        >
          Contact
        </a>
      </div>
    </div>
  </section>
);
