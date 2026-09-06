import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, QrCode as QrIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { fetchAllocationById } from "@/lib/data/allocations";
import { confirmSecondLife, STAGE_LABEL } from "@/lib/data/handoffs";
import { handoffReference, parseScannedId } from "@/services/handoff/codes";
import { QrScanner } from "@/components/system/QrScanner";
import { GlowButton } from "@/components/system/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * The receiving end of a handoff.
 *
 * A donor pressing "I handed it over" is a claim, not proof, which is exactly
 * the gap a scan closes: the organization reads a code that names one specific
 * allocation and confirms against that record. The QR is only a pointer — the
 * database still checks that whoever is signed in owns the receiving
 * organization before it shows anything or accepts a confirmation.
 */
export default function VerifyHandoff() {
  const { allocationId } = useParams<{ allocationId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const loader = useMemo(
    () => async () => (allocationId ? fetchAllocationById(allocationId) : null),
    [allocationId]
  );
  const { data: allocation, loading, error, reload } = useAsync(loader, [loader]);

  const isOrganization = profile?.accountType === "organization";

  const open = (raw: string) => {
    const id = parseScannedId(raw, "verify");
    if (!id) {
      setScanError("That code is not a ReHome handoff code.");
      return;
    }
    setScanError(null);
    setScanning(false);
    navigate(`/app/verify/${id}`);
  };

  const onConfirm = async () => {
    if (!allocation) return;
    setBusy(true);
    setActionError(null);
    try {
      await confirmSecondLife(allocation.id);
      setConfirmed(true);
      await reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not confirm this handoff."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ── No code yet: scan one ─────────────────────────────────────────── */
  if (!allocationId) {
    return (
      <div className="relative mx-auto max-w-xl px-5 pb-24 pt-16">
        <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">HANDOFF VERIFICATION</p>
        <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
          Scan the donor's code.
        </h1>
        <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-white/50">
          The code names one specific handoff. Confirming against it is what records the donor's
          impact — nothing counts until you do.
        </p>

        {scanning ? (
          <div className="mt-8">
            <QrScanner onResult={open} onClose={() => setScanning(false)} />
          </div>
        ) : (
          <GlowButton className="mt-8" onClick={() => setScanning(true)}>
            <QrIcon className="h-4 w-4" />
            Scan handoff QR
          </GlowButton>
        )}

        <div className="mt-10 border-t border-white/[0.07] pt-8">
          <label className="block">
            <span className="text-[13px] text-white/40">Or enter the reference the donor reads out</span>
            <input
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setScanError(null); }}
              placeholder="RH-XXXX-XXXX"
              className="mt-2 w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-[19px] uppercase tracking-[0.12em] text-white outline-none transition-colors focus:border-lime-300/60"
            />
          </label>
          <p className="mt-3 text-[13px] leading-relaxed text-white/35">
            The reference identifies the handoff on your Handoffs list — open it there and confirm
            from the card. A reference alone cannot confirm anything on its own.
          </p>
          <GlowButton
            variant="ghost"
            className="mt-5"
            onClick={() => navigate("/app/handoffs")}
          >
            Open handoffs
          </GlowButton>
        </div>

        {scanError ? <p className="mt-6 text-[15px] text-rose-300">{scanError}</p> : null}
      </div>
    );
  }

  /* ── A specific handoff ────────────────────────────────────────────── */
  const item = allocation?.item;
  const org = allocation?.requirement?.organization;
  const settled = allocation?.status === "confirmed" || confirmed;

  return (
    <div className="relative mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">HANDOFF VERIFICATION</p>

      {loading ? <div className="mt-8"><LoadingState label="Reading the handoff" /></div> : null}
      {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}

      {!loading && !error && !allocation ? (
        <div className="mt-8">
          <EmptyState message="No handoff matches that code, or it is not one you are party to." />
          <GlowButton variant="ghost" className="mt-6" onClick={() => navigate("/app/verify")}>
            Scan another code
          </GlowButton>
        </div>
      ) : null}

      {allocation ? (
        <>
          <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
            {item?.item_type ?? "Item"}
            <span className="ml-3 align-middle text-[18px] font-medium text-white/45">
              ×{allocation.quantity_allocated}
            </span>
          </h1>

          <p className="rh-mono mt-3 text-[12px] tracking-[0.24em] text-white/40">
            {handoffReference(allocation.id)}
          </p>

          <dl className="rh-inset mt-9 rounded-[20px] px-6 py-5">
            {[
              ["Destination", org?.name ?? "Organization"],
              ["Requirement", allocation.requirement?.item_type ?? "—"],
              ["Condition", item?.condition ?? "—"],
              ["Stage", STAGE_LABEL[allocation.status]],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`flex justify-between gap-6 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
              >
                <dt className="text-[15px] text-white/35">{k}</dt>
                <dd className="text-right text-[15px] text-white/85">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Deliberately absent: who the donor is. The organization needs to
              know what arrived, not who lives where. */}
          <p className="mt-4 text-[13px] leading-relaxed text-white/30">
            ReHome does not share the donor's identity or address with a destination.
          </p>

          {settled ? (
            <div
              className="mt-8 overflow-hidden rounded-[20px] border border-lime-300/20 px-5 py-6"
              style={{ background: "linear-gradient(180deg, rgba(30,92,70,0.22), rgba(6,11,16,0.6))" }}
            >
              <p className="inline-flex items-center gap-2 text-[13px] text-lime-300/90">
                <ShieldCheck className="h-3.5 w-3.5" />
                Receipt confirmed
              </p>
              <p className="mt-3 font-display text-xl font-semibold leading-snug tracking-tight">
                {allocation.quantity_allocated} {item?.item_type?.toLowerCase() ?? "item"} recorded
                as received.
              </p>
              <p className="mt-2 text-[13px] text-white/45">
                The donor's impact has been written against this handoff.
              </p>
              <GlowButton variant="ghost" className="mt-6" onClick={() => navigate("/app/handoffs")}>
                Back to handoffs
              </GlowButton>
            </div>
          ) : isOrganization ? (
            <>
              {actionError ? <div className="mt-6"><ErrorState message={actionError} /></div> : null}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <GlowButton onClick={onConfirm} disabled={busy} className="sm:flex-1">
                  <Check className="h-4 w-4" />
                  {busy ? "Confirming…" : "Confirm receipt"}
                </GlowButton>
                <GlowButton variant="ghost" onClick={() => navigate("/app/handoffs")}>
                  Not now
                </GlowButton>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/30">
                Confirm only what you have physically received. This is the step that records the
                donor's impact.
              </p>
            </>
          ) : (
            <p className="mt-8 rounded-[16px] border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-[15px] leading-relaxed text-white/55">
              Only the receiving organization can confirm this handoff. Show this code to them at
              the counter.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
