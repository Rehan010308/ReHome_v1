/**
 * The moment the image is read.
 *
 * Corner brackets close in, a line sweeps the frame, and the status underneath
 * names the stage that is genuinely running. Nothing here invents a bounding
 * box or a label — it is the honest visual of "this is being looked at", and
 * the real result replaces it the moment analysis returns.
 */
export const AnalysisScanner = ({
  src,
  stage,
  settled = false,
}: {
  src: string;
  /** Short label for what is happening right now. */
  stage: string;
  /** Once true the sweep stops and the frame locks. */
  settled?: boolean;
}) => (
  <figure className="relative mx-auto w-full max-w-sm">
    <div className="relative overflow-hidden rounded-[20px] bg-black/40">
      <img
        src={src}
        alt=""
        className={`block max-h-[320px] w-full object-contain transition-all duration-700 ${
          settled ? "opacity-100 saturate-100" : "opacity-80 saturate-[0.6]"
        }`}
      />

      {/* Measurement grid, only while reading. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          settled ? "opacity-0" : "opacity-100"
        }`}
        style={{
          backgroundImage:
            "linear-gradient(rgba(163,230,53,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.13) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, black, transparent)",
        }}
      />

      {/* Brackets: wide while searching, tight once settled. */}
      {[
        "left-0 top-0 border-l-2 border-t-2 rounded-tl-[14px]",
        "right-0 top-0 border-r-2 border-t-2 rounded-tr-[14px]",
        "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-[14px]",
        "right-0 bottom-0 border-r-2 border-b-2 rounded-br-[14px]",
      ].map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={`pointer-events-none absolute h-9 w-9 border-lime-300 transition-all duration-700 ${corner}`}
          style={{ margin: settled ? "12px" : "26px", opacity: settled ? 0.95 : 0.55 }}
        />
      ))}

      {!settled ? (
        <>
          <span className="rh-scanline" aria-hidden />
          <style>{`
            @keyframes rhScanSweep {
              0%   { transform: translateY(-8%); opacity: 0; }
              12%  { opacity: 1; }
              88%  { opacity: 1; }
              100% { transform: translateY(108%); opacity: 0; }
            }
            .rh-scanline {
              position: absolute; left: 0; right: 0; top: 0; height: 2px;
              background: linear-gradient(90deg, transparent, rgba(163,230,53,0.85), rgba(140,255,205,1), rgba(163,230,53,0.85), transparent);
              box-shadow: 0 0 18px rgba(163,230,53,0.6);
              animation: rhScanSweep 1.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            @media (prefers-reduced-motion: reduce) { .rh-scanline { animation: none; opacity: 0.5; } }
          `}</style>
        </>
      ) : null}
    </div>

    <figcaption className="mt-5 flex items-center justify-center gap-2.5 text-[13px] text-white/50">
      {!settled ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-300" />
        </span>
      ) : null}
      {stage}
    </figcaption>
  </figure>
);
