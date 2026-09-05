import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { commandPath, type AccountType } from "@/lib/profile";
import { GlowButton, PageShell } from "@/components/system/primitives";

export default function AccountType() {
  const { profile, setAccountType, error } = useAuth();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<AccountType>(profile?.accountType ?? "individual");
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    setBusy(true);
    try {
      await setAccountType(choice);
      navigate(commandPath(choice), { replace: true });
    } catch {
      /* context error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell className="grid min-h-[100dvh] place-items-center px-4 py-16">
      <div className="w-full max-w-xl">
        <p className="text-[11px] tracking-[0.4em] uppercase text-lime-200/75 font-semibold">Onboarding</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">How will you use ReHome?</h1>
        <p className="mt-3 text-white/55 leading-relaxed">
          This routes you to the correct command center. Organization profiles will expand in Phase 3.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setChoice("individual")}
            className={`rounded-[22px] border p-6 text-left ${
              choice === "individual" ? "border-lime-300/50 bg-lime-300/10" : "border-white/10 bg-white/5"
            }`}
          >
            <User className="h-6 w-6 text-lime-300" />
            <p className="mt-4 font-display text-xl font-semibold">Individual</p>
            <p className="mt-2 text-sm text-white/50">Scan items, track rehoming activity, and view impact.</p>
          </button>
          <button
            type="button"
            onClick={() => setChoice("organization")}
            className={`rounded-[22px] border p-6 text-left ${
              choice === "organization" ? "border-lime-300/50 bg-lime-300/10" : "border-white/10 bg-white/5"
            }`}
          >
            <Building2 className="h-6 w-6 text-lime-300" />
            <p className="mt-4 font-display text-xl font-semibold">Organization</p>
            <p className="mt-2 text-sm text-white/50">Publish requirements and receive matched items.</p>
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <GlowButton className="mt-8" onClick={onContinue} disabled={busy}>
          {busy ? "Saving…" : "Continue"}
        </GlowButton>
      </div>
    </PageShell>
  );
}
