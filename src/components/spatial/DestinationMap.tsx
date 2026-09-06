import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { coordsOf, distanceKm, formatDistance, type Coordinates } from "@/services/geo";

/**
 * The destination surface.
 *
 * Google Maps renders inside ReHome's own frame when a key is configured. That
 * key is a browser key by design and must be HTTP-referrer restricted in the
 * Google console — it is not a secret, and no secret key ever belongs here.
 *
 * Without a key the component does not degrade to a broken embed or a
 * decorative picture of a map: it draws the real geometry it actually has —
 * two known points, the true great-circle distance between them, and the
 * bearing — so every number on screen still comes from data.
 */

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();

/** Urban average, stated as an estimate because no routing service is called. */
const AVERAGE_URBAN_KMH = 24;

function travelEstimate(km: number): string {
  const minutes = Math.round((km / AVERAGE_URBAN_KMH) * 60);
  if (minutes < 1) return "a few minutes";
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `about ${h} h ${m} min` : `about ${h} h`;
}

function bearing(from: Coordinates, to: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/* ── Route geometry ─────────────────────────────────────────────────────────
 * One set of numbers drives the path, the markers and the labels, so nothing
 * can drift out of alignment. The three stops sit on the curve by construction:
 * ORIGIN and DEST are its endpoints and HUB is the join between its two cubic
 * segments, which is exactly on the curve.
 */
const ORIGIN = { x: 58, y: 172 };
const HUB = { x: 200, y: 132 };
const DEST = { x: 330, y: 94 };

const ROUTE_PATH =
  `M ${ORIGIN.x} ${ORIGIN.y} ` +
  `C 100 174, 152 142, ${HUB.x} ${HUB.y} ` +
  `C 246 122, 290 100, ${DEST.x} ${DEST.y}`;

/** Horizon of the perspective floor — everything above it is sky. */
const HORIZON = 62;
/** Where the floor's parallel lines converge. */
const VANISHING = { x: 200, y: HORIZON };

/**
 * Floor lines, spaced so they crowd toward the horizon. A linear spacing reads
 * as a flat grid seen head-on; this reads as ground receding away from you,
 * which is what makes the route look like a journey rather than a diagram.
 */
const FLOOR_ROWS = Array.from({ length: 7 }, (_, i) => {
  const t = (i + 1) / 7;
  return HORIZON + (220 - HORIZON) * t ** 2.1;
});

const FLOOR_COLUMNS = Array.from({ length: 13 }, (_, i) => -280 + i * 80);

/** Long organization names would run off the frame; the footer carries the full one. */
function shortLabel(label: string, max = 20): string {
  const clean = label.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

const Stop = ({
  at,
  label,
  tone,
  size,
}: {
  at: { x: number; y: number };
  label: string;
  tone: "origin" | "hub" | "dest";
  size: number;
}) => {
  const fill = tone === "dest" ? "#a3e635" : tone === "hub" ? "#bef264" : "#7ce7b0";
  const text = shortLabel(label);
  // Roughly half the rendered width, so the label can be nudged back inside.
  const halfWidth = text.length * 2.9;
  const labelX = Math.min(Math.max(at.x, halfWidth + 4), 396 - halfWidth);
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={size * 4.5} fill="url(#rh-halo)" />
      {tone === "dest" ? (
        <circle
          cx={at.x}
          cy={at.y}
          r={size * 2.2}
          fill="none"
          stroke="#a3e635"
          strokeOpacity="0.35"
          strokeWidth="1.25"
          className="rh-route-ping"
        />
      ) : null}
      <circle cx={at.x} cy={at.y} r={size} fill={fill} />
      <text
        x={labelX}
        y={at.y + size + 17}
        textAnchor="middle"
        fill={tone === "hub" ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.55)"}
        fontSize="10.5"
        letterSpacing="0.06em"
      >
        {text}
      </text>
    </g>
  );
};

/** Real geometry, drawn. Not a stand-in for a map — a diagram of what we know. */
function RouteDiagram({
  from,
  to,
  km,
  originLabel,
  destinationLabel,
}: {
  from: Coordinates | null;
  to: Coordinates;
  km: number | null;
  originLabel: string;
  destinationLabel: string;
}) {
  const angle = from ? bearing(from, to) : null;

  return (
    <svg viewBox="0 0 400 220" className="h-full w-full" role="img" aria-label="Route overview">
      <defs>
        <linearGradient id="rh-route" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#7ce7b0" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#a3e635" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="rh-halo">
          <stop offset="0%" stopColor="#a3e635" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
        </radialGradient>
        {/* The floor fades out toward the horizon rather than stopping at a line. */}
        <linearGradient id="rh-floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" />
          <stop offset="45%" stopColor="#9a9a9a" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="rh-floor-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="22%" stopColor="#fff" />
          <stop offset="78%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id="rh-floor-mask">
          <rect x="0" y={HORIZON} width="400" height={220 - HORIZON} fill="url(#rh-floor-fade)" />
        </mask>
        <mask id="rh-floor-edge-mask">
          <rect x="0" y="0" width="400" height="220" fill="url(#rh-floor-edge)" />
        </mask>
      </defs>

      {/* Perspective floor, converging on a single vanishing point. */}
      <g mask="url(#rh-floor-mask)">
        <g mask="url(#rh-floor-edge-mask)">
        {FLOOR_ROWS.map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            x2="400"
            y1={y}
            y2={y}
            stroke="rgba(190,255,220,0.09)"
            strokeWidth="1"
          />
        ))}
        {FLOOR_COLUMNS.map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="220"
            x2={VANISHING.x}
            y2={VANISHING.y}
            stroke="rgba(190,255,220,0.07)"
            strokeWidth="1"
          />
        ))}
        </g>
      </g>

      {/* The route: a dim rail underneath, the lit line drawing along it. */}
      <path
        id="rh-route-path"
        d={ROUTE_PATH}
        fill="none"
        stroke="rgba(163,230,53,0.16)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={ROUTE_PATH}
        fill="none"
        stroke="url(#rh-route)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="rh-route-draw"
      />

      {/* One vehicle along the route, following the same path the line drew. */}
      <circle r="3" fill="#eaffc3" className="rh-route-vehicle">
        <animateMotion dur="5.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1">
          <mpath href="#rh-route-path" />
        </animateMotion>
      </circle>

      {from ? <Stop at={ORIGIN} label={originLabel} tone="origin" size={4.5} /> : null}
      <Stop at={HUB} label="ReHome" tone="hub" size={3} />
      <Stop at={DEST} label={destinationLabel} tone="dest" size={5.5} />

      {km !== null && from ? (
        <g transform="translate(200, 78)">
          <text textAnchor="middle" fill="#a3e635" fontSize="15" fontWeight="600">
            {formatDistance(km)?.replace(" away", "")}
          </text>
          <text y="15" textAnchor="middle" fill="rgba(255,255,255,0.32)" fontSize="9.5">
            {travelEstimate(km)}
            {angle !== null ? ` · bearing ${Math.round((angle + 360) % 360)}°` : ""}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function DestinationMap({
  destination,
  origin,
  organizationName,
  originName,
  className = "",
}: {
  destination: { latitude: number | null; longitude: number | null };
  origin?: { latitude: number | null; longitude: number | null } | null;
  organizationName: string;
  /** The donor's own place name, shown so the route names both of its ends. */
  originName?: string | null;
  className?: string;
}) {
  const to = coordsOf(destination);
  const from = origin ? coordsOf(origin) : null;
  const km = to && from ? distanceKm(from, to) : null;

  // Reveal on entry: the map is the payoff of confirming a destination, so it
  // arrives rather than simply being present.
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setRevealed(true),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const embedSrc = useMemo(() => {
    if (!MAPS_KEY || !to) return null;
    const q = `${to.latitude},${to.longitude}`;
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(MAPS_KEY)}&q=${encodeURIComponent(q)}&zoom=14&maptype=roadmap`;
  }, [to]);

  if (!to) {
    return (
      <div className={`rounded-[22px] border border-white/[0.07] bg-white/[0.02] px-5 py-6 ${className}`}>
        <p className="text-[15px] text-white/45">
          {organizationName} has not shared a location yet, so ReHome cannot show the route or
          estimate the journey.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-[22px] border border-white/[0.08] transition-all duration-700 ${
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      } ${className}`}
      style={{ background: "linear-gradient(180deg, rgba(9,17,22,0.95), rgba(5,10,16,0.9))" }}
    >
      <div className="relative h-[220px] w-full">
        {embedSrc ? (
          <iframe
            title={`Map showing ${organizationName}`}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
            style={{ filter: "saturate(0.75) contrast(1.05) brightness(0.82)" }}
          />
        ) : (
          <RouteDiagram
            from={from}
            to={to}
            km={km}
            originLabel={originName ?? "You"}
            destinationLabel={organizationName}
          />
        )}

        {/* ReHome frame over the top, so the map sits inside the product. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,10,16,0.55) 0%, transparent 30%, transparent 60%, rgba(5,10,16,0.85) 100%)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] px-5 py-4">
        <p className="inline-flex items-center gap-2 text-[15px] text-white/85">
          <MapPin className="h-4 w-4 text-lime-300" />
          {organizationName}
          {originName ? <span className="text-[13px] text-white/35">from {originName}</span> : null}
        </p>
        {km !== null ? (
          <p className="inline-flex items-center gap-2 text-[13px] text-white/45">
            <Navigation className="h-3.5 w-3.5 text-lime-300/70" />
            {formatDistance(km)?.replace(" away", "")} — {travelEstimate(km)}
            <span className="text-white/25">estimated</span>
          </p>
        ) : (
          <p className="text-[13px] text-white/35">
            Share a location to see the distance and journey.
          </p>
        )}
      </div>
    </div>
  );
}
