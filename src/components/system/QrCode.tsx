import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A QR code, rendered as SVG.
 *
 * SVG rather than canvas so it stays sharp when someone holds a phone up to a
 * laptop screen, which is the only interaction that matters here — every QR in
 * ReHome exists to be scanned by the other party in a physical handoff, never
 * as decoration.
 *
 * The quiet zone is not optional: scanners need four modules of margin, and
 * codes that fail to read in the field are usually codes drawn without it.
 */
export function QrCode({
  value,
  size = 190,
  className = "",
  label,
}: {
  value: string;
  size?: number;
  className?: string;
  /** Accessible description of what scanning this does. */
  label?: string;
}) {
  const { path, dimension } = useMemo(() => {
    // Type 0 lets the library pick the smallest version that fits; medium error
    // correction survives a fingerprint on a phone screen.
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const quiet = 4;
    const total = count + quiet * 2;

    let d = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) {
          d += `M${col + quiet},${row + quiet}h1v1h-1z`;
        }
      }
    }
    return { path: d, dimension: total };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      width={size}
      height={size}
      className={`block rounded-[10px] ${className}`}
      role="img"
      aria-label={label ?? "QR code"}
      shapeRendering="crispEdges"
    >
      {/* Light quiet zone and background: scanners expect dark-on-light. */}
      <rect width={dimension} height={dimension} fill="#f4f7f2" />
      <path d={path} fill="#06120c" />
    </svg>
  );
}
