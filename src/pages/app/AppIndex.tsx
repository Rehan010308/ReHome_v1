import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { commandPath } from "@/lib/profile";

export default function AppIndex() {
  const { profile } = useAuth();
  if (!profile?.accountType) return <Navigate to="/onboarding/account-type" replace />;
  return <Navigate to={commandPath(profile.accountType)} replace />;
}
