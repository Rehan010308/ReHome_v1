import { useEffect, useState } from "react";
import { Camera, ScanLine, CheckCircle2 } from "lucide-react";
import { SectionHeading, PremiumCard } from "@/components/system/primitives";
import { classifyImage } from "@/services/ai";
import type { AIClassificationResult } from "@/services/ai";

const capabilities = [
  "Category",
  "Sub-category",
  "Item type",
  "Condition",
  "Reusability",
  "Potential use",
  "Confidence",
];

const sampleLabel = "sample textbook photo (placeholder input)";

export const ReVisionAI = () => {
  const [result, setResult] = useState<AIClassificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    classifyImage(sampleLabel).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Array<{ label: string; value: string }> = result
    ? [
        { label: "Category", value: result.category },
        { label: "Sub-category", value: result.subCategory },
        { label: "Item type", value: result.itemType },
        { label: "Condition", value: result.condition },
        { label: "Reusability", value: result.reusability },
        { label: "Potential use", value: result.potentialUse },
      ]
    : [];

  return (
    <section id="revision-ai" className="relative py-20 md:py-28 overflow-hidden bg-[#070c12] text-white">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="blob-float-slow absolute top-10 right-[-120px] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(38,120,84,0.22) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4">
        <SectionHeading
          inverted
          eyebrow="ReVision AI"
          title="Intelligence that"
          highlight="understands objects"
          subtitle="Snap a photo and receive a structured profile the matching engine can act on — not a paragraph of guesswork."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mt-14 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-lime-300/15 border border-lime-300/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-lime-300" />
              </div>
              <h3 className="font-display font-semibold text-lg">Structured results, not random text</h3>
            </div>
            <p className="text-white/60 leading-relaxed">
              For every item, ReVision AI returns a profile the rest of ReHome can route:
            </p>
            <ul className="space-y-2.5">
              {capabilities.map((cap) => (
                <li key={cap} className="flex items-center gap-2.5 text-white/80">
                  <CheckCircle2 className="w-4 h-4 text-lime-300 shrink-0" />
                  <span className="text-sm">{cap}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-white/35">
              Demo output from the placeholder AI service — the production model plugs into the same contract later.
            </p>
          </div>

          <PremiumCard className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center">
                  <ScanLine className="w-4 h-4 text-lime-300" />
                </div>
                <span className="font-display font-semibold">Analysis Result</span>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-lime-300/20 text-lime-200/80 tracking-[0.18em] uppercase">
                Live demo
              </span>
            </div>

            {loading || !result ? (
              <div className="space-y-3 py-6">
                <div className="flex items-center justify-center gap-2 text-sm text-white/50">
                  <div className="w-4 h-4 border-2 border-lime-300 border-t-transparent rounded-full animate-spin" />
                  ReVision AI is analysing a sample item…
                </div>
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 rounded-xl bg-white/8 animate-pulse" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wide">{row.label}</span>
                    <span className="text-sm font-semibold">{row.value}</span>
                  </div>
                ))}
                <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Confidence</span>
                    <span className="text-sm font-bold text-lime-300">{result.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </PremiumCard>
        </div>
      </div>
    </section>
  );
};
