import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Leaf, LogOut } from "lucide-react";
import { useAuth, useCommandHome } from "@/context/AuthContext";

const individualLinks = [
  { to: "/app/individual", label: "Command" },
  { to: "/app/scan", label: "Scan" },
  { to: "/app/matches", label: "Destinations" },
  { to: "/app/handoffs", label: "Handoffs" },
  { to: "/app/impact", label: "Impact" },
  { to: "/app/profile", label: "Profile" },
];

const organizationLinks = [
  { to: "/app/organization", label: "Command" },
  { to: "/app/requirements", label: "Needs" },
  { to: "/app/matches", label: "Supply" },
  { to: "/app/handoffs", label: "Handoffs" },
  { to: "/app/profile", label: "Profile" },
];

/**
 * The chrome stays quiet so the content can be the loud thing. The active
 * route is marked with a single lit dot rather than a filled pill — one signal,
 * not a competing surface.
 */
const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative px-1 py-1 text-[14px] transition-colors ${
    isActive ? "text-white" : "text-white/40 hover:text-white/75"
  }`;

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
    <div className="flex min-h-screen flex-col bg-[#050a10] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050a10]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-8 px-5 py-4">
          <NavLink to={home} className="flex shrink-0 items-center gap-2">
            <Leaf className="h-[18px] w-[18px] text-lime-300" />
            <span className="font-display text-[17px] font-bold tracking-tight">ReHome</span>
          </NavLink>

          <nav className="hidden flex-1 items-center gap-7 md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive ? (
                      <span className="absolute -bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime-300" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-5">
            {profile?.accountType ? (
              <span className="hidden text-[13px] text-white/30 sm:block">
                {profile.accountType === "organization" ? "Organization" : "Individual"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 text-[13px] text-white/40 transition-colors hover:text-white/80"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile: the same links, scrollable, no second visual language. */}
        <div className="flex gap-6 overflow-x-auto px-5 pb-3 md:hidden">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navClass}>
              {({ isActive }) => (
                <span className="whitespace-nowrap">
                  {link.label}
                  {isActive ? (
                    <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-lime-300 align-middle" />
                  ) : null}
                </span>
              )}
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
