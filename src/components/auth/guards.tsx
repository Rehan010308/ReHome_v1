import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/system/primitives";

const SessionScreen = () => (
  <PageShell>
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-lime-300/15 animate-pulse shadow-[0_0_50px_rgba(163,230,53,0.35)] grid place-items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-lime-300" />
        </div>
        <p className="text-[10px] tracking-[0.4em] uppercase text-lime-100/60">Restoring session</p>
      </div>
    </div>
  </PageShell>
);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <SessionScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { loading, user, profile } = useAuth();

  if (loading) return <SessionScreen />;
  if (user) {
    if (!profile?.accountType) return <Navigate to="/onboarding/account-type" replace />;
    return (
      <Navigate
        to={profile.accountType === "organization" ? "/app/organization" : "/app/individual"}
        replace
      />
    );
  }

  return <>{children}</>;
};

export const RequireAccountType = ({
  type,
  children,
}: {
  type: "individual" | "organization";
  children: ReactNode;
}) => {
  const { loading, profile } = useAuth();

  if (loading) return <SessionScreen />;
  if (!profile?.accountType) {
    return <Navigate to="/onboarding/account-type" replace />;
  }

  if (profile.accountType !== type) {
    return (
      <Navigate
        to={profile.accountType === "organization" ? "/app/organization" : "/app/individual"}
        replace
      />
    );
  }

  return <>{children}</>;
};
