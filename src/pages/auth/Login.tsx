import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { GlowButton, PageShell } from "@/components/system/primitives";

export default function Login() {
  const { signIn, configured, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(from && from.startsWith("/app") ? from : "/app", { replace: true });
    } catch {
      /* error shown from context */
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell className="pt-28 pb-16">
      <div className="relative mx-auto w-full max-w-md px-4">
        <p className="text-[11px] tracking-[0.4em] uppercase text-lime-200/75 font-semibold">Command access</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-3 text-white/55 leading-relaxed">
          Continue to your Individual or Organization command center.
        </p>

        {!configured ? (
          <p className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100/90">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable authentication.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 space-y-4" onChange={clearError}>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rh-input"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Password</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rh-input"
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <GlowButton type="submit" className="w-full" disabled={busy || !configured}>
            {busy ? "Authenticating…" : "Enter ReHome"}
            <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </form>

        <p className="mt-6 text-sm text-white/45">
          New to ReHome?{" "}
          <Link to="/signup" className="text-lime-300 hover:text-lime-200">
            Create an account
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
