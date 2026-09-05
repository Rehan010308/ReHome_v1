import { Link } from "react-router-dom";
import { Leaf, Mail } from "lucide-react";
import { scrollToSection } from "@/lib/scrollTo";

const exploreLinks = [
  { id: "how-it-works", label: "How It Works" },
  { id: "revision-ai", label: "ReVision AI" },
  { id: "partners", label: "Local Partners" },
  { id: "rewards", label: "Reward Points" },
  { id: "impact", label: "Impact" },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-[#070c12] text-white mt-auto overflow-hidden border-t border-white/8">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-lime-300/10 p-2 rounded-xl">
                <Leaf className="h-5 w-5 text-lime-300" />
              </div>
              <span className="text-xl font-display font-bold">ReHome</span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Unused items, understood by intelligence, routed to where they create the most value next.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-xs uppercase tracking-[0.22em] text-white/40">Explore</h3>
            <ul className="space-y-2.5 text-sm">
              {exploreLinks.map(({ id, label }) => (
                <li key={id}>
                  <button
                    onClick={() => scrollToSection(id)}
                    className="text-white/55 hover:text-lime-300 transition-colors"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-xs uppercase tracking-[0.22em] text-white/40">Access</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/login" className="text-white/55 hover:text-lime-300">
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-white/55 hover:text-lime-300">
                  Create account
                </Link>
              </li>
              <li className="text-white/35">Terms — coming soon</li>
              <li className="text-white/35">Privacy — coming soon</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-xs uppercase tracking-[0.22em] text-white/40">Contact</h3>
            <a
              href="mailto:support@rehome.app"
              className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-lime-300"
            >
              <Mail className="h-4 w-4" />
              support@rehome.app
            </a>
          </div>
        </div>

        <div className="border-t border-white/8 mt-10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/35">© {currentYear} ReHome. All rights reserved.</p>
          <p className="text-xs text-white/35">Give items a second life.</p>
        </div>
      </div>
    </footer>
  );
};
