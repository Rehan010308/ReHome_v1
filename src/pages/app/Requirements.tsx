import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { closeRequirement, createRequirement, listOrgRequirements } from "@/lib/data/catalog";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import type { UrgencyLevel } from "@/types/database";
import { GlowButton, StatusBadge } from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

const urgencies: UrgencyLevel[] = ["low", "medium", "high", "critical"];

export default function Requirements() {
  const { profile } = useAuth();
  const orgQuery = useAsync(async () => (profile ? fetchOwnOrganization(profile.userId) : null), [profile?.userId]);
  const org = orgQuery.data;
  const listQuery = useAsync(async () => (org ? listOrgRequirements(org.id) : []), [org?.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "",
    subcategory: "",
    item_type: "",
    quantity_requested: 1,
    required_condition: "Any",
    location: org?.location ?? profile?.location ?? "",
    urgency: "medium" as UrgencyLevel,
    notes: "",
  });

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    setError(null);
    try {
      await createRequirement({
        organization_id: org.id,
        category: form.category.trim(),
        subcategory: form.subcategory.trim(),
        item_type: form.item_type.trim(),
        quantity_requested: Number(form.quantity_requested) || 1,
        required_condition: form.required_condition.trim() || "Any",
        location: form.location.trim(),
        urgency: form.urgency,
        notes: form.notes.trim() || undefined,
      });
      setForm((prev) => ({ ...prev, category: "", subcategory: "", item_type: "", notes: "", quantity: 1 }));
      await listQuery.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create requirement.");
    } finally {
      setBusy(false);
    }
  };

  const onClose = async (id: string) => {
    setError(null);
    try {
      await closeRequirement(id);
      await listQuery.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not close requirement.");
    }
  };

  const rows = listQuery.data ?? [];

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Resource board</StatusBadge>
      <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Requirements</h1>
      <p className="mt-3 text-white/55 leading-relaxed">
        These records are the demand side of matching. Be specific — item type and condition change
        who gets scored against you.
      </p>

      {orgQuery.loading ? <div className="mt-6"><LoadingState label="Loading organization" /></div> : null}
      {orgQuery.error ? <div className="mt-6"><ErrorState message={orgQuery.error} /></div> : null}
      {!orgQuery.loading && !org ? (
        <div className="mt-6">
          <ErrorState message="No organization profile found. Finish onboarding as an organization." />
        </div>
      ) : null}

      {org ? (
        <form onSubmit={onCreate} className="mt-8 rh-card rounded-[22px] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                ["category", "Category"],
                ["subcategory", "Subcategory"],
                ["item_type", "Item type"],
                ["required_condition", "Required condition"],
                ["location", "Location"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-2 sm:col-span-1">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
                <input
                  className="rh-input"
                  required={key !== "subcategory"}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Quantity</span>
              <input
                className="rh-input"
                type="number"
                min={1}
                required
                value={form.quantity_requested}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity_requested: Number(e.target.value) }))}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Urgency</span>
              <select
                className="rh-input bg-[#0b1218]"
                value={form.urgency}
                onChange={(e) => setForm((prev) => ({ ...prev, urgency: e.target.value as UrgencyLevel }))}
              >
                {urgencies.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Notes</span>
            <textarea
              className="rh-input min-h-[88px]"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <GlowButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Publish requirement"}
          </GlowButton>
        </form>
      ) : null}

      <div className="mt-8 space-y-3">
        {listQuery.loading ? <LoadingState label="Loading requirements" /> : null}
        {listQuery.error ? <ErrorState message={listQuery.error} /> : null}
        {!listQuery.loading && rows.length === 0 ? <EmptyState message="No requirements yet." /> : null}
        {rows.map((row) => (
          <div key={row.id} className="rh-card rounded-[20px] p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold">{row.item_type}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
                {row.category} · {row.quantity_received}/{row.quantity_requested} contributed · {row.quantity_remaining} remaining
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-lime-200/80">{row.urgency}</span>
              {row.status === "open" ? (
                <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => void onClose(row.id)}>
                  Close
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
