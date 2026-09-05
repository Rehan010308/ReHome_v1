import { FormEvent, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { closeRequirement, createRequirement, listOrgRequirements } from "@/lib/data/catalog";
import { listRequirementContributions } from "@/lib/data/allocations";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import type { MatchAllocationRow, RequirementRow, UrgencyLevel } from "@/types/database";
import { STAGE_LABEL } from "@/lib/data/handoffs";
import { GlowButton, StatusBadge } from "@/components/system/primitives";
import { FulfillmentMeter } from "@/components/system/FulfillmentMeter";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

const urgencies: UrgencyLevel[] = ["low", "medium", "high", "critical"];

const statusTone: Record<string, string> = {
  open: "text-white/45",
  partially_fulfilled: "text-lime-200/85",
  fulfilled: "text-lime-200",
  expired: "text-white/30",
  closed: "text-white/30",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  partially_fulfilled: "Partly met",
  fulfilled: "Fully met",
  expired: "Expired",
  closed: "Closed",
};

/**
 * Contributors are shown without identity. An organization needs to know how
 * its demand is being met, not who lives where — donor identity stays private
 * until a handoff is arranged.
 */
function Contributions({ requirementId }: { requirementId: string }) {
  const { data, loading, error } = useAsync(
    async () => listRequirementContributions(requirementId),
    [requirementId]
  );

  if (loading) return <p className="mt-4 text-xs text-white/30">Loading contributions…</p>;
  if (error) return <div className="mt-4"><ErrorState message={error} /></div>;

  const rows = (data ?? []) as MatchAllocationRow[];
  if (rows.length === 0) {
    return <p className="mt-4 text-xs text-white/30">No contributions committed yet.</p>;
  }

  return (
    <ul className="mt-4 space-y-2.5">
      {rows.map((row, i) => (
        <li key={row.id} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-white/60">
            Donor {i + 1}
            <span className="ml-2 font-semibold text-white/85">×{row.quantity_allocated}</span>
          </span>
          <span className={row.status === "confirmed" ? "text-xs text-lime-200" : "text-xs text-white/40"}>
            {STAGE_LABEL[row.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RequirementRowView({
  row,
  onClose,
}: {
  row: RequirementRow;
  onClose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const live = row.status === "open" || row.status === "partially_fulfilled";

  return (
    <article className="border-b border-white/8 py-6 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight">{row.item_type}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/35">
            {row.category}
            {row.urgency === "high" || row.urgency === "critical" ? ` · ${row.urgency} urgency` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-xs ${statusTone[row.status] ?? "text-white/40"}`}>
            {statusLabel[row.status] ?? row.status}
          </span>
          <ChevronRight className={`h-4 w-4 text-white/25 transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </button>

      <div className="mt-4">
        <FulfillmentMeter requested={row.quantity_requested} received={row.quantity_received} />
      </div>

      {open ? (
        <div className="mt-5 rounded-[16px] border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Who is contributing</p>
          <Contributions requirementId={row.id} />

          {row.notes ? <p className="mt-4 text-sm text-white/45">{row.notes}</p> : null}

          {live ? (
            <button
              type="button"
              onClick={() => onClose(row.id)}
              className="mt-5 text-xs uppercase tracking-[0.16em] text-white/35 hover:text-white/70"
            >
              Close this requirement
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function Requirements() {
  const { profile } = useAuth();
  const orgQuery = useAsync(
    async () => (profile ? fetchOwnOrganization(profile.userId) : null),
    [profile?.userId]
  );
  const org = orgQuery.data;
  const listQuery = useAsync(async () => (org ? listOrgRequirements(org.id) : []), [org?.id]);

  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "", subcategory: "", item_type: "",
    quantity_requested: 1, required_condition: "Any",
    urgency: "medium" as UrgencyLevel, notes: "",
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
        quantity_requested: Math.max(1, Number(form.quantity_requested) || 1),
        required_condition: form.required_condition.trim() || "Any",
        location: org.location ?? undefined,
        // Inherits the organization's point, so distance works without asking
        // for an address again.
        latitude: org.latitude,
        longitude: org.longitude,
        urgency: form.urgency,
        notes: form.notes.trim() || undefined,
      });
      setForm((p) => ({ ...p, category: "", subcategory: "", item_type: "", notes: "", quantity_requested: 1 }));
      setComposing(false);
      await listQuery.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish this requirement.");
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
      setError(cause instanceof Error ? cause.message : "Could not close this requirement.");
    }
  };

  const rows = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Demand</StatusBadge>
      <h1 className="mt-5 font-display text-3xl md:text-4xl font-bold tracking-tight">
        What you need
      </h1>
      <p className="mt-3 max-w-xl leading-relaxed text-white/55">
        Be specific. Item type and condition decide which donations get scored against you,
        and quantity is what makes partial contributions add up correctly.
      </p>

      {orgQuery.loading ? <div className="mt-8"><LoadingState label="Loading organization" /></div> : null}
      {orgQuery.error ? <div className="mt-8"><ErrorState message={orgQuery.error} /></div> : null}
      {!orgQuery.loading && !org ? (
        <div className="mt-8">
          <ErrorState message="No organization profile found. Finish onboarding as an organization." />
        </div>
      ) : null}
      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}

      {org && !composing ? (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="group mt-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors hover:border-lime-300/40 hover:bg-white/8"
        >
          <Plus className="h-4 w-4 text-lime-300" />
          Post what you need
        </button>
      ) : null}

      {org && composing ? (
        <form onSubmit={onCreate} className="mt-8 space-y-4 rounded-[22px] border border-white/10 bg-white/[0.02] p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              ["item_type", "What do you need", true],
              ["category", "Category", true],
              ["subcategory", "Subcategory", false],
              ["required_condition", "Minimum condition", false],
            ] as const).map(([key, label, required]) => (
              <label key={key} className="block space-y-2">
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</span>
                <input
                  className="rh-input"
                  required={required}
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">How many</span>
              <input
                className="rh-input"
                type="number"
                min={1}
                required
                value={form.quantity_requested}
                onChange={(e) => setForm((p) => ({ ...p, quantity_requested: Number(e.target.value) }))}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Urgency</span>
              <select
                className="rh-input bg-[#0b1218]"
                value={form.urgency}
                onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value as UrgencyLevel }))}
              >
                {urgencies.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">Anything else</span>
            <textarea
              className="rh-input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <GlowButton type="submit" disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </GlowButton>
          </div>
        </form>
      ) : null}

      <div className="mt-12">
        {listQuery.loading ? <LoadingState label="Loading requirements" /> : null}
        {listQuery.error ? <ErrorState message={listQuery.error} /> : null}
        {!listQuery.loading && rows.length === 0 && org ? (
          <EmptyState message="Nothing posted yet. Donations are matched against what you publish here." />
        ) : null}

        {rows.length > 0 ? (
          <div className="border-t border-white/8">
            {rows.map((row) => (
              <RequirementRowView key={row.id} row={row} onClose={onClose} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
