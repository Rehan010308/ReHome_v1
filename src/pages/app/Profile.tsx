import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AnimatedBackground, GlowButton, StatusBadge } from "@/components/system/primitives";

export default function ProfilePage() {
  const { profile, updateName, error, clearError } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await updateName(name);
      setSaved(true);
    } catch {
      /* context */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative mx-auto max-w-2xl px-4 py-10 md:py-14">
        <StatusBadge>Profile</StatusBadge>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Account identity</h1>
        <p className="mt-3 text-white/55">
          Phase 2 keeps this lean. A full profile record will persist in Supabase during Phase 3.
        </p>

        <dl className="mt-8 rh-card rounded-[22px] p-6 space-y-4">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-white/40">User ID</dt>
            <dd className="mt-1 break-all text-sm text-white/80">{profile?.userId}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-white/40">Email</dt>
            <dd className="mt-1 text-sm">{profile?.email}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-white/40">Account type</dt>
            <dd className="mt-1 text-sm capitalize">{profile?.accountType ?? "Not set"}</dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" onChange={clearError}>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="rh-input" required />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {saved ? <p className="text-sm text-lime-300">Name updated.</p> : null}
          <GlowButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save name"}
          </GlowButton>
        </form>
      </div>
    </div>
  );
}
