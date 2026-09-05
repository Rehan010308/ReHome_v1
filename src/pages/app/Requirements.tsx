import { StatusBadge } from "@/components/system/primitives";

const samples = [
  { need: "Mathematics textbooks", qty: "30", urgency: "High" },
  { need: "Winter clothing", qty: "Open", urgency: "Seasonal" },
  { need: "Refurbished laptops", qty: "8", urgency: "Medium" },
];

export default function Requirements() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Resource board</StatusBadge>
      <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Requirements</h1>
      <p className="mt-3 text-white/55 leading-relaxed">
        Placeholder demand cards so the Organization workspace feels complete. Creating and
        persisting real requirements is Phase 3.
      </p>
      <div className="mt-8 space-y-3">
        {samples.map((row) => (
          <div key={row.need} className="rh-card rounded-[20px] p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold">{row.need}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">Quantity {row.qty}</p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-lime-200/80">{row.urgency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
