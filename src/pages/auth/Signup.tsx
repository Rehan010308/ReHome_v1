import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { AccountType } from "@/lib/profile";
import { Reveal } from "@/components/system/Reveal";
import { GlowButton } from "@/components/system/primitives";

const ROLES = [
  {
    value: "individual" as const,
    icon: User,
    title: "I have things",
    body: "Households with items they no longer use.",
  },
  {
    value: "organization" as const,
    icon: Building2,
    title: "I need things",
    body: "Schools, shelters, charities, refurbishers, recyclers.",
  },
];

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
      if (result.needsEmailConfirmation) setConfirmNote(true);
      else navigate("/app", { replace: true });
    } catch {
      /* surfaced from context */
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: "name" | "email" | "password",
    label: string,
    type: string,
    autoComplete: string,
    value: string,
    set: (v: string) => void
  ) => (
    <label key={key} className="block">
      <span className="text-[13px] text-white/40">{label}</span>
      <input
        required
        minLength={key === "password" ? 6 : undefined}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-2 w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-[19px] text-white outline-none transition-colors focus:border-lime-300/60"
      />
    </label>
  );

  return (
    <div className="relative min-h-screen bg-[#050a10] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{ background: "radial-gradient(65% 50% at 50% 0%, rgba(30,92,70,0.30), transparent 72%)" }}
      />

      <div className="relative mx-auto max-w-lg px-6 py-24">
        <Reveal>
          <h1 className="font-display text-[clamp(2.4rem,7vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.025em]">
            Which side are
            <span className="block text-white/40">you on?</span>
          </h1>
        </Reveal>

        {!configured ? (
          <p className="mt-10 rounded-[16px] border border-amber-300/20 bg-amber-300/[0.07] px-5 py-4 text-[15px] text-amber-100/90">
            Authentication is not configured. Add your Supabase URL and anon key to <code>.env</code>.
          </p>
        ) : null}

        {confirmNote ? (
          <p className="rh-lit mt-10 rounded-[16px] px-5 py-4 text-[15px] text-lime-100">
            Check your email to confirm the account, then sign in.
          </p>
        ) : null}

        <Reveal delay={80}>
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const on = accountType === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setAccountType(role.value)}
                  className={`rounded-[20px] p-6 text-left transition-all duration-300 ${
                    on ? "rh-lit" : "rh-inset hover:border-white/20"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${on ? "text-lime-300" : "text-white/40"}`} />
                  <p
                    className={`mt-5 font-display text-lg font-semibold ${
                      on ? "text-lime-100" : "text-white/90"
                    }`}
                  >
                    {role.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">{role.body}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="mt-12 space-y-8" onChange={clearError}>
            {field("name", "Name", "text", "name", name, setName)}
            {field("email", "Email", "email", "email", email, setEmail)}
            {field("password", "Password", "password", "new-password", password, setPassword)}

            {error ? <p className="text-[15px] text-rose-300">{error}</p> : null}

            <GlowButton type="submit" className="w-full" disabled={busy || !configured}>
              {busy ? "Creating account…" : "Create account"}
            </GlowButton>
          </form>

          <p className="mt-10 text-[15px] text-white/40">
            Already have access?{" "}
            <Link to="/login" className="text-lime-300 transition-colors hover:text-lime-200">
              Sign in
            </Link>
          </p>
        </Reveal>
      </div>
    </div>
  );
}
