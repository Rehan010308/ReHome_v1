import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Leaf, Menu, X } from "lucide-react";
import { scrollToSection } from "@/lib/scrollTo";
import { useAuth, useCommandHome } from "@/context/AuthContext";

const links = [
  { id: "how-it-works", label: "How It Works" },
  { id: "revision-ai", label: "ReVision AI" },
  { id: "partners", label: "Partners" },
  { id: "rewards", label: "Rewards" },
  { id: "impact", label: "Impact" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const commandHome = useCommandHome();

  const go = (id: string) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      window.setTimeout(() => scrollToSection(id), 80);
      return;
    }
    scrollToSection(id);
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
      <div className="rh-nav rounded-full px-4 md:px-6 py-2.5 md:py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <div className="bg-lime-300/10 p-1.5 rounded-full">
              <Leaf className="h-5 w-5 text-lime-300" />
            </div>
            <span className="text-lg md:text-xl font-display font-bold hidden sm:block text-white">
              ReHome
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => go(link.id)}
                className="px-3 py-2 text-sm font-medium text-white/70 hover:text-white rounded-full hover:bg-white/8 transition-colors"
              >
                {link.label}
              </button>
            ))}
            {user ? (
              <Link
                to={commandHome}
                className="ml-2 inline-flex items-center rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#06231a]"
              >
                Command Center
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="ml-1 inline-flex items-center rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-emerald-400 px-5 py-2 text-sm font-bold uppercase tracking-[0.12em] text-[#06231a]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden">
            <button
              type="button"
              className="p-2.5 rounded-full text-white hover:bg-white/10"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden mt-2 rh-nav rounded-2xl p-4 flex flex-col gap-1">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => go(link.id)}
              className="text-left px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/8 rounded-xl"
            >
              {link.label}
            </button>
          ))}
          {user ? (
            <Link
              to={commandHome}
              onClick={() => setOpen(false)}
              className="mt-2 text-center rounded-full bg-lime-300 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#06231a]"
            >
              Command Center
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm text-white/80"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="mt-1 text-center rounded-full bg-lime-300 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#06231a]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};
