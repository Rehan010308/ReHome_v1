import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { AccountType } from "@/lib/profile";
import { GlowButton, PageShell } from "@/components/system/primitives";

export default function Signup() {
  const { signUp, configured, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [busy, setBusy] = useState(false);
  const [confirmNote, setConfirmNote] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    setBusy(true);
    setConfirmNote(false);
    try {
      const result = await signUp({ name, email, password, accountType });
      if (result.needsEmailConfirmation) {
        setConfirmNote(true);
      } else {
        navigate("/app", { replace: true });
      }
    } catch {
      /* context error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell className="pt-28 pb-16">
      <div className="relative mx-auto w-full max-w-lg px-4">
        <p className="text-[11px] tracking-[0.4em] uppercase text-lime-200/75 font-semibold">Begin rehoming</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-3 text-white/55 leading-relaxed">
          Choose how you will use ReHome. You can change profile details later.
        </p>

        {!configured ? (
          <p className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100/90">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable authentication.
          </p>
        ) : null}

        {confirmNote ? (
          <p className="mt-8 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">
            Check your email to confirm this account, then sign in.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 space-y-5" onChange={clearError}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType("individual")}
              className={`rounded-[20px] border p-4 text-left transition-all ${
                accountType === "individual"
                  ? "border-lime-300/50 bg-lime-300/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <User className="h-5 w-5 text-lime-300" />
              <p className="mt-3 font-display font-semibold">Individual</p>
              <p className="mt-1 text-xs text-white/50 leading-relaxed">Households rehoming unused items.</p>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("organization")}
              className={`rounded-[20px] border p-4 text-left transition-all ${
                accountType === "organization"
                  ? "border-lime-300/50 bg-lime-300/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <Building2 className="h-5 w-5 text-lime-300" />
              <p className="mt-3 font-display font-semibold">Organization</p>
              <p className="mt-1 text-xs text-white/50 leading-relaxed">NGOs, schools, shelters, and community groups.</p>
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="rh-input" autoComplete="name" />
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rh-input"
              autoComplete="email"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Password</span>
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rh-input"
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <GlowButton type="submit" className="w-full" disabled={busy || !configured}>
            {busy ? "Creating account…" : "Create account"}
            <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </form>

        <p className="mt-6 text-sm text-white/45">
          Already have access?{" "}
          <Link to="/login" className="text-lime-300 hover:text-lime-200">
            Sign in
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
