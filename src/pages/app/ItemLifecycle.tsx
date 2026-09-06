import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { fetchItemById } from "@/lib/data/catalog";
import type { ItemStatus } from "@/types/database";
import { QrCode } from "@/components/system/QrCode";
import { itemLifecycleUrl } from "@/services/handoff/codes";
import { EmptyState, ErrorState, LoadingState } from "@/components/system/DataState";

/**
 * What happened to one object.
 *
 * This is what an item QR opens. It is a record of the object's journey and
 * nothing else — no donor name, no address, no contact details, and no
 * organization-side demand figures. Everything shown is a field that describes
 * the item itself or a lifecycle state it has genuinely reached.
 */

const LIFECYCLE: Array<{ status: ItemStatus; label: string; detail: string }> = [
  { status: "listed", label: "Created", detail: "Read, assessed and added to ReHome." },
  { status: "matched", label: "Matched", detail: "Scored against open demand." },
  { status: "allocated", label: "Committed", detail: "Reserved against a requirement." },
  { status: "handoff_scheduled", label: "Handoff arranged", detail: "A time and place were set." },
  { status: "handed_over", label: "Handed over", detail: "The donor passed it across." },
  {
    status: "second_life_confirmed",
    label: "Second life",
    detail: "The organization confirmed receipt.",
  },
];

const REACHED: Record<ItemStatus, number> = {
  listed: 0,
  analyzing: 0,
  confirmed: 0,
  matched: 1,
  allocated: 2,
  handoff_scheduled: 3,
  handed_over: 4,
  second_life_confirmed: 5,
  withdrawn: -1,
};

export default function ItemLifecycle() {
  const { itemId } = useParams<{ itemId: string }>();
  const loader = useMemo(() => async () => (itemId ? fetchItemById(itemId) : null), [itemId]);
  const { data: item, loading, error } = useAsync(loader, [loader]);

  const reached = item ? REACHED[item.status] : -1;

  return (
    <div className="relative mx-auto max-w-xl px-5 pb-24 pt-16">
      <p className="rh-mono text-[10px] tracking-[0.3em] text-lime-200/60">ITEM LIFECYCLE</p>

      {loading ? <div className="mt-8"><LoadingState label="Reading the record" /></div> : null}
      {error ? <div className="mt-8"><ErrorState message={error} /></div> : null}
      {!loading && !error && !item ? (
        <div className="mt-8">
          <EmptyState message="No item matches that code, or it is not one you can read." />
        </div>
      ) : null}

      {item ? (
        <>
          <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.025em]">
            {item.item_type}
            {item.quantity > 1 ? (
              <span className="ml-3 align-middle text-[18px] font-medium text-white/45">
                ×{item.quantity}
              </span>
            ) : null}
          </h1>
          <p className="mt-3 text-[16px] text-white/45">
            {item.category}
            {item.condition ? <span className="ml-3 text-white/30">{item.condition}</span> : null}
          </p>

          <ol className="mt-10 border-t border-white/[0.06]">
            {LIFECYCLE.map((step, i) => {
              const done = reached >= i;
              const now = reached === i;
              return (
                <li key={step.status} className="flex gap-4 border-b border-white/[0.06] py-4">
                  <span className="pt-1.5">
                    <span className={`rh-tick ${now ? "is-now" : done ? "is-done" : ""}`} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[15px] ${
                        now ? "text-lime-200" : done ? "text-white/85" : "text-white/25"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className={`mt-1 text-[13px] ${done ? "text-white/40" : "text-white/20"}`}>
                      {step.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-7">
            <QrCode
              value={itemLifecycleUrl(item.id)}
              size={128}
              label={`Lifecycle record for ${item.item_type}`}
            />
            <div className="min-w-0">
              <p className="rh-mono text-[10px] tracking-[0.22em] text-white/35">ITEM CODE</p>
              <p className="mt-2 max-w-[15rem] text-[13px] leading-relaxed text-white/40">
                Scanning this opens exactly this page. It carries no donor identity, no address
                and no contact details.
              </p>
            </div>
          </div>

          <Link
            to="/app/individual"
            className="mt-10 inline-block text-[13px] text-lime-300/90 hover:text-lime-200"
          >
            Back to command centre
          </Link>
        </>
      ) : null}
    </div>
  );
}
