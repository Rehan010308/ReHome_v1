import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AnimatedBackground, GlowButton, StatusBadge } from "@/components/system/primitives";

export default function SettingsPage() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-2xl px-4 py-10 md:py-14">
        <StatusBadge>Settings</StatusBadge>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Session & preferences</h1>
        <p className="mt-3 text-white/55 leading-relaxed">
          Notifications, collection logistics, and reward preferences will land in later phases.
        </p>
        <div className="mt-8 rh-card rounded-[22px] p-6 space-y-4">
          <p className="text-sm text-white/60">
            Signed in as <span className="text-white">{profile?.email}</span>
          </p>
          <GlowButton variant="ghost" onClick={onSignOut}>
            Sign out of this device
          </GlowButton>
        </div>
      </div>
    </div>
  );
}
