import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization, updateOrganization } from "@/lib/data/profiles";
import { AnimatedBackground, GlowButton, StatusBadge } from "@/components/system/primitives";
import { ErrorState } from "@/components/system/DataState";

export default function ProfilePage() {
  const { profile, updateProfileDetails, error, clearError } = useAuth();
  const orgQuery = useAsync(
    async () => (profile?.accountType === "organization" ? fetchOwnOrganization(profile.userId) : null),
    [profile?.accountType, profile?.userId]
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    location: profile?.location ?? "",
    bio: profile?.bio ?? "",
  });
  const [orgForm, setOrgForm] = useState({
    name: "",
    org_type: "community",
    description: "",
    location: "",
    contact_email: "",
    contact_phone: "",
    website: "",
  });

  useEffect(() => {
    setForm({
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      location: profile?.location ?? "",
      bio: profile?.bio ?? "",
    });
  }, [profile]);

  useEffect(() => {
    const org = orgQuery.data;
    if (!org) return;
    setOrgForm({
      name: org.name,
      org_type: org.org_type,
      description: org.description ?? "",
      location: org.location ?? "",
      contact_email: org.contact_email ?? "",
      contact_phone: org.contact_phone ?? "",
      website: org.website ?? "",
    });
  }, [orgQuery.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setOrgError(null);
    try {
      await updateProfileDetails({
        name: form.name,
        phone: form.phone,
        location: form.location,
        bio: form.bio,
      });
      if (orgQuery.data) {
        await updateOrganization(orgQuery.data.id, {
          name: orgForm.name.trim(),
          org_type: orgForm.org_type.trim(),
          description: orgForm.description.trim(),
          location: orgForm.location.trim(),
          contact_email: orgForm.contact_email.trim(),
          contact_phone: orgForm.contact_phone.trim(),
          website: orgForm.website.trim(),
        });
        await orgQuery.reload();
      }
      setSaved(true);
    } catch (cause) {
      setOrgError(cause instanceof Error ? cause.message : "Could not save profile.");
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
          Contact and location details feed matching proximity. Organization verification cannot be
          set from this form.
        </p>

        <dl className="mt-8 rh-card rounded-[22px] p-6 space-y-4">
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
          {(
            [
              ["name", "Display name"],
              ["phone", "Phone"],
              ["location", "Location"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="rh-input"
                required={key === "name"}
              />
            </label>
          ))}
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Profile notes</span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              className="rh-input min-h-[96px]"
            />
          </label>

          {orgQuery.data ? (
            <div className="space-y-4 rounded-[22px] border border-white/10 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Organization</p>
              {(
                [
                  ["name", "Organization name"],
                  ["org_type", "Organization type"],
                  ["location", "Organization location"],
                  ["contact_email", "Contact email"],
                  ["contact_phone", "Contact phone"],
                  ["website", "Website"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
                  <input
                    className="rh-input"
                    value={orgForm[key]}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    required={key === "name"}
                  />
                </label>
              ))}
              <label className="block space-y-2">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Description</span>
                <textarea
                  className="rh-input min-h-[96px]"
                  value={orgForm.description}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <p className="text-xs text-white/40">
                Verification: {orgQuery.data.verification_status}
                {orgQuery.data.is_directory ? " · directory listing" : ""}
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {orgError ? <ErrorState message={orgError} /> : null}
          {saved ? <p className="text-sm text-lime-300">Profile saved.</p> : null}
          <GlowButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </GlowButton>
        </form>
      </div>
    </div>
  );
}
