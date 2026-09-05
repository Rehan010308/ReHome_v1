import { useState } from "react";
import { Camera } from "lucide-react";
import { StatusBadge } from "@/components/system/primitives";

const story = ["Object", "Scanning", "Understanding", "Structuring", "Matching", "Destination"] as const;

export default function ScanItem() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setStage(1);
    window.setTimeout(() => setStage(2), 600);
    window.setTimeout(() => setStage(3), 1200);
    window.setTimeout(() => setStage(4), 1800);
    window.setTimeout(() => setStage(5), 2400);
  };

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-14">
      <StatusBadge>Item intake</StatusBadge>
      <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Scan an item</h1>
      <p className="mt-3 text-white/55 leading-relaxed">
        This screen establishes the intake ritual. Object detection and production AI are
        intentionally not connected yet.
      </p>

      <label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center hover:border-lime-300/30 hover:bg-white/[0.05] transition-colors">
        <Camera className="h-8 w-8 text-lime-300" />
        <span className="mt-4 font-display text-lg">Drop a photo or choose a file</span>
        <span className="mt-2 text-sm text-white/40">Images stay on this device in Phase 2.</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {fileName ? (
        <div className="mt-8 rh-card rounded-[22px] p-6">
          <p className="text-sm text-white/60">{fileName}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {story.map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
                  i <= stage ? "bg-lime-300/15 text-lime-200" : "bg-white/5 text-white/30"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/45">
            Intake captured locally. Classification, storage, and matching wait for later phases.
          </p>
        </div>
      ) : null}
    </div>
  );
}
