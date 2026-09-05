import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Reveal } from "@/components/system/Reveal";
import { GlowButton } from "@/components/system/primitives";

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
      /* surfaced from context */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050a10] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{ background: "radial-gradient(65% 50% at 50% 0%, rgba(30,92,70,0.30), transparent 72%)" }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
        <Reveal>
          <h1 className="font-display text-[clamp(2.4rem,7vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.025em]">
            Welcome back.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-white/45">
            Pick up where your items left off.
          </p>
        </Reveal>

        {!configured ? (
          <p className="mt-10 rounded-[16px] border border-amber-300/20 bg-amber-300/[0.07] px-5 py-4 text-[15px] text-amber-100/90">
            Authentication is not configured. Add your Supabase URL and anon key to <code>.env</code>.
          </p>
        ) : null}

        <Reveal delay={90}>
          <form onSubmit={onSubmit} className="mt-12 space-y-8" onChange={clearError}>
            <label className="block">
              <span className="text-[13px] text-white/40">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-[19px] text-white outline-none transition-colors focus:border-lime-300/60"
              />
            </label>

            <label className="block">
              <span className="text-[13px] text-white/40">Password</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-[19px] text-white outline-none transition-colors focus:border-lime-300/60"
              />
            </label>

            {error ? <p className="text-[15px] text-rose-300">{error}</p> : null}

            <GlowButton type="submit" className="w-full" disabled={busy || !configured}>
              {busy ? "Signing in…" : "Sign in"}
            </GlowButton>
          </form>

          <p className="mt-10 text-[15px] text-white/40">
            New here?{" "}
            <Link to="/signup" className="text-lime-300 transition-colors hover:text-lime-200">
              Create an account
            </Link>
          </p>
        </Reveal>
      </div>
    </div>
  );
}
