import { useMemo, useState } from "react";
import { Check, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchOwnOrganization } from "@/lib/data/profiles";
import { listDonorAllocations, listOrganizationAllocations } from "@/lib/data/allocations";
import {
  cancelAllocation,
  confirmSecondLife,
  fetchHandoffsByAllocation,
  markHandedOver,
  scheduleHandoff,
  HANDOFF_STAGES,
  STAGE_LABEL,
  type HandoffRow,
} from "@/lib/data/handoffs";
import type { AllocationWithContext } from "@/types/database";
import { GlowButton, StatusBadge } from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

type Role = "donor" | "organization";

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Four beats, with the current one lit. Cancelled collapses the rail entirely. */
const StageRail = ({ status }: { status: AllocationWithContext["status"] }) => {
  if (status === "cancelled") {
    return <p className="text-xs uppercase tracking-[0.18em] text-white/30">Cancelled</p>;
  }
  const current = HANDOFF_STAGES.indexOf(status);
  return (
    <div className="flex items-center gap-1.5" aria-label={`Stage: ${STAGE_LABEL[status]}`}>
      {HANDOFF_STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i < current ? "bg-white/35" : i === current ? "bg-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.7)]" : "bg-white/12"
            }`}
          />
          {i < HANDOFF_STAGES.length - 1 ? (
            <span className={`h-px w-5 ${i < current ? "bg-white/25" : "bg-white/8"}`} />
          ) : null}
        </div>
      ))}
      <span className="ml-2 text-xs text-white/55">{STAGE_LABEL[status]}</span>
    </div>
  );
};

function ScheduleForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: HandoffRow | undefined;
  busy: boolean;
  onSubmit: (when: string, where: string) => void;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState(
    initial?.scheduled_for ? new Date(initial.scheduled_for).toISOString().slice(0, 16) : ""
  );
  const [where, setWhere] = useState(initial?.handoff_location ?? "");

  return (
    <div className="mt-5 space-y-3 rounded-[16px] border border-white/8 bg-white/[0.02] p-4">
      <label className="block space-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">When</span>
        <input
          type="datetime-local"
          className="rh-input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
          Where — a public meeting point, not a home address
        </span>
        <input
          className="rh-input"
          placeholder="e.g. School reception, Gate 2"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
        />
      </label>
      <div className="flex gap-2 pt-1">
        <GlowButton
          disabled={busy || !when}
          onClick={() => onSubmit(new Date(when).toISOString(), where)}
        >
          {busy ? "Saving…" : initial?.scheduled_for ? "Reschedule" : "Confirm time"}
        </GlowButton>
        <GlowButton variant="ghost" onClick={onCancel}>
          Cancel
        </GlowButton>
      </div>
    </div>
  );
}

function AllocationCard({
  row,
  handoff,
  role,
  busy,
  onAction,
}: {
  row: AllocationWithContext;
  handoff: HandoffRow | undefined;
  role: Role;
  busy: boolean;
  onAction: (action: "schedule" | "handed" | "confirm" | "cancel", payload?: { when: string; where: string }) => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const item = row.item;
  const req = row.requirement;
  const org = req?.organization;

  const counterparty = role === "donor" ? (org?.name ?? "Organization") : (item?.item_type ?? "Item");
  const when = formatWhen(handoff?.scheduled_for ?? null);
  const closed = row.status === "confirmed" || row.status === "cancelled";

  return (
    <article className="border-b border-white/8 py-6 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight">
            {item?.item_type ?? "Item"}
            <span className="ml-2 text-sm font-normal text-white/45">
              ×{row.quantity_allocated}
            </span>
          </p>
          <p className="mt-1 text-sm text-white/50">
            {role === "donor" ? `To ${counterparty}` : `From a donor · for ${req?.item_type}`}
          </p>
        </div>
        <StageRail status={row.status} />
      </div>

      {when || handoff?.handoff_location ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
          {when ? <span>{when}</span> : null}
          {handoff?.handoff_location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-lime-300/70" />
              {handoff.handoff_location}
            </span>
          ) : null}
        </p>
      ) : null}

      {row.status === "confirmed" ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-lime-200">
          <Check className="h-4 w-4" />
          {role === "donor"
            ? `${row.quantity_allocated} recorded in your impact`
            : "Confirmed received"}
        </p>
      ) : null}

      {scheduling ? (
        <ScheduleForm
          initial={handoff}
          busy={busy}
          onCancel={() => setScheduling(false)}
          onSubmit={(when_, where_) => {
            setScheduling(false);
            onAction("schedule", { when: when_, where: where_ });
          }}
        />
      ) : !closed ? (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {row.status === "allocated" || row.status === "handoff_scheduled" ? (
            <GlowButton
              variant={row.status === "allocated" ? "solid" : "ghost"}
              disabled={busy}
              onClick={() => setScheduling(true)}
            >
              {handoff?.scheduled_for ? "Reschedule" : "Arrange handoff"}
            </GlowButton>
          ) : null}

          {role === "donor" && row.status === "handoff_scheduled" ? (
            <GlowButton disabled={busy} onClick={() => onAction("handed")}>
              {busy ? "Saving…" : "I handed it over"}
            </GlowButton>
          ) : null}

          {role === "organization" && (row.status === "handed_over" || row.status === "handoff_scheduled") ? (
            <GlowButton disabled={busy} onClick={() => onAction("confirm")}>
              {busy ? "Confirming…" : "Confirm received"}
            </GlowButton>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("cancel")}
            className="text-xs uppercase tracking-[0.16em] text-white/35 hover:text-white/70 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {role === "donor" && row.status === "handed_over" ? (
        <p className="mt-3 text-xs text-white/35">
          Waiting on {org?.name ?? "the organization"} to confirm. Nothing counts as rehomed
          until they do.
        </p>
      ) : null}
    </article>
  );
}

export default function Handoffs() {
  const { profile } = useAuth();
  const role: Role = profile?.accountType === "organization" ? "organization" : "donor";
  const userId = profile?.userId;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loader = useMemo(
    () => async () => {
      if (!userId) return { rows: [] as AllocationWithContext[], handoffs: new Map<string, HandoffRow>() };
      const rows =
        role === "organization"
          ? await (async () => {
              const org = await fetchOwnOrganization(userId);
              return org ? listOrganizationAllocations(org.id) : [];
            })()
          : await listDonorAllocations(userId);
      const handoffs = await fetchHandoffsByAllocation(rows.map((r) => r.id));
      return { rows, handoffs };
    },
    [role, userId]
  );

  const { data, loading, error, reload } = useAsync(loader, [loader]);
  const rows = data?.rows ?? [];
  const handoffs = data?.handoffs ?? new Map<string, HandoffRow>();

  const active = rows.filter((r) => r.status !== "confirmed" && r.status !== "cancelled");
  const settled = rows.filter((r) => r.status === "confirmed" || r.status === "cancelled");

  const onAction = async (
    row: AllocationWithContext,
    action: "schedule" | "handed" | "confirm" | "cancel",
    payload?: { when: string; where: string }
  ) => {
    setBusyId(row.id);
    setActionError(null);
    try {
      if (action === "schedule" && payload) {
        await scheduleHandoff({
          allocationId: row.id,
          scheduledFor: payload.when,
          location: payload.where || undefined,
        });
      } else if (action === "handed") {
        await markHandedOver(row.id);
      } else if (action === "confirm") {
        await confirmSecondLife(row.id);
      } else if (action === "cancel") {
        await cancelAllocation(row.id);
      }
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not update this handoff.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Handoffs</StatusBadge>
      <h1 className="mt-5 font-display text-3xl md:text-4xl font-bold tracking-tight">
        {role === "organization" ? "Incoming contributions" : "Your commitments"}
      </h1>
      <p className="mt-3 max-w-xl leading-relaxed text-white/55">
        {role === "organization"
          ? "Arrange collection, then confirm what actually arrived. Confirmation is what records a donor's impact."
          : "Arrange the handoff, then tell us when you have passed it on. The organization confirms receipt to complete it."}
      </p>

      {actionError ? <div className="mt-6"><ErrorState message={actionError} /></div> : null}

      <div className="mt-8">
        {loading ? <LoadingState label="Loading handoffs" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            message={
              role === "organization"
                ? "Nothing committed to your requirements yet."
                : "Accept a destination and it will appear here."
            }
          />
        ) : null}

        {active.length > 0 ? (
          <div className="border-t border-white/8">
            {active.map((row) => (
              <AllocationCard
                key={row.id}
                row={row}
                handoff={handoffs.get(row.id)}
                role={role}
                busy={busyId === row.id}
                onAction={(action, payload) => onAction(row, action, payload)}
              />
            ))}
          </div>
        ) : null}

        {settled.length > 0 ? (
          <div className="mt-12">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/30">Settled</p>
            <div className="mt-2 border-t border-white/8">
              {settled.map((row) => (
                <AllocationCard
                  key={row.id}
                  row={row}
                  handoff={handoffs.get(row.id)}
                  role={role}
                  busy={busyId === row.id}
                  onAction={(action, payload) => onAction(row, action, payload)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
