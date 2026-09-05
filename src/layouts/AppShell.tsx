import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Leaf, LogOut } from "lucide-react";
import { useAuth, useCommandHome } from "@/context/AuthContext";
import { StatusBadge } from "@/components/system/primitives";

const individualLinks = [
  { to: "/app/individual", label: "Command" },
  { to: "/app/scan", label: "Scan" },
  { to: "/app/matches", label: "Matches" },
  { to: "/app/handoffs", label: "Handoffs" },
  { to: "/app/impact", label: "Impact" },
  { to: "/app/profile", label: "Profile" },
  { to: "/app/settings", label: "Settings" },
];

const organizationLinks = [
  { to: "/app/organization", label: "Command" },
  { to: "/app/requirements", label: "Requirements" },
  { to: "/app/matches", label: "Matches" },
  { to: "/app/handoffs", label: "Handoffs" },
  { to: "/app/profile", label: "Profile" },
  { to: "/app/settings", label: "Settings" },
];

export const AppShell = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const home = useCommandHome();
  const links = profile?.accountType === "organization" ? organizationLinks : individualLinks;

  const onSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050a10] text-white flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050a10]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to={home} className="flex items-center gap-2">
            <div className="rounded-full bg-lime-300/10 p-1.5">
              <Leaf className="h-4 w-4 text-lime-300" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">ReHome</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-white/55 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {profile?.accountType ? (
              <StatusBadge>
                {profile.accountType === "organization" ? "Organization" : "Individual"}
              </StatusBadge>
            ) : null}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/70 hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <div className="md:hidden flex gap-1 overflow-x-auto px-4 pb-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  isActive ? "bg-white/10 text-white" : "text-white/50"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};
