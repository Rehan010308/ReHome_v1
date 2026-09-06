import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { distanceKm, formatDistance, type Coordinates } from "@/services/geo";

/**
 * The handoff journey, on a real map.
 *
 * Two raster sources, both genuine map data, chosen by what is configured:
 *
 *   • Google Static Maps, when VITE_GOOGLE_MAPS_API_KEY is set. That key is a
 *     browser key by design and must be HTTP-referrer restricted in the Google
 *     console — it is not a secret, and no secret key belongs in a bundle.
 *   • Otherwise OpenStreetMap's own tiles, which need no key. They ship light,
 *     so a filter inverts them into ReHome's palette. That is a colour
 *     treatment on real cartography, not a drawing of one: every road, city and
 *     coastline on screen is where OSM says it is.
 *
 * CARTO's basemap was the first choice here and had to be dropped — their
 * keyless tiles now come back stamped "API KEY REQUIRED", which is exactly the
 * kind of fake-looking map this component exists to avoid.
 *
 * Markers, the corridor and the readout are drawn by ReHome on top, so the map
 * sits inside the product rather than the product sitting inside a map widget.
 *
 * One honesty constraint shapes the whole component: no directions API is
 * called, so the line between the two points is the direct corridor and is
 * labelled as such. Drawing an invented road path would be a picture of a
 * journey nobody computed.
 */

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();

const TILE = 256;
const OSM_TILES = "https://tile.openstreetmap.org";

/** Light cartography, turned dark. The geometry underneath is untouched. */
const DARK_MAP_FILTER =
  "invert(1) hue-rotate(180deg) saturate(0.42) brightness(0.78) contrast(1.08)";

/** Urban average, stated as an estimate because no routing service is called. */
const AVERAGE_URBAN_KMH = 24;

export function travelEstimate(km: number): string {
  const minutes = Math.round((km / AVERAGE_URBAN_KMH) * 60);
  if (minutes < 1) return "a few min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function bearingBetween(from: Coordinates, to: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLon = rad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(rad(to.latitude));
  const x =
    Math.cos(rad(from.latitude)) * Math.sin(rad(to.latitude)) -
    Math.sin(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function compassOf(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8];
}

/* ── Web-Mercator, the same projection every slippy map uses ───────────────── */
function project(c: Coordinates, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const sinLat = Math.sin((c.latitude * Math.PI) / 180);
  return {
    x: ((c.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

/** Largest zoom at which both ends still fit inside the frame, with padding. */
function fitZoom(a: Coordinates, b: Coordinates, width: number, height: number): number {
  const padX = width * 0.28;
  const padY = height * 0.34;
  for (let z = 17; z >= 2; z -= 1) {
    const pa = project(a, z);
    const pb = project(b, z);
    if (Math.abs(pa.x - pb.x) <= width - padX && Math.abs(pa.y - pb.y) <= height - padY) {
      return z;
    }
  }
  return 2;
}

interface Frame {
  zoom: number;
  /** Pixel offset of the viewport's top-left corner in world space. */
  originX: number;
  originY: number;
  toScreen: (c: Coordinates) => { x: number; y: number };
}

function buildFrame(a: Coordinates, b: Coordinates, width: number, height: number): Frame {
  const zoom = fitZoom(a, b, width, height);
  const pa = project(a, zoom);
  const pb = project(b, zoom);
  const centerX = (pa.x + pb.x) / 2;
  const centerY = (pa.y + pb.y) / 2;
  const originX = centerX - width / 2;
  const originY = centerY - height / 2;
  return {
    zoom,
    originX,
    originY,
    toScreen: (c) => {
      const p = project(c, zoom);
      return { x: p.x - originX, y: p.y - originY };
    },
  };
}

/** The raster layer: real tiles, positioned by the same projection as the markers. */
function TileLayer({
  frame,
  width,
  height,
  onFailure,
}: {
  frame: Frame;
  width: number;
  height: number;
  onFailure: () => void;
}) {
  const failures = useRef(0);
  const firstTileX = Math.floor(frame.originX / TILE);
  const firstTileY = Math.floor(frame.originY / TILE);
  const lastTileX = Math.floor((frame.originX + width) / TILE);
  const lastTileY = Math.floor((frame.originY + height) / TILE);
  const span = 2 ** frame.zoom;

  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
  for (let tx = firstTileX; tx <= lastTileX; tx += 1) {
    for (let ty = firstTileY; ty <= lastTileY; ty += 1) {
      if (ty < 0 || ty >= span) continue;
      const wrapped = ((tx % span) + span) % span;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `${OSM_TILES}/${frame.zoom}/${wrapped}/${ty}.png`,
        left: tx * TILE - frame.originX,
        top: ty * TILE - frame.originY,
      });
    }
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ filter: DARK_MAP_FILTER }}
      aria-hidden
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          width={TILE}
          height={TILE}
          loading="lazy"
          decoding="async"
          onError={() => {
            failures.current += 1;
            // A couple of missing tiles is normal at the edges; a wall of them
            // means the provider is unreachable, and the schematic is better
            // than a grey rectangle pretending to be a map.
            if (failures.current > 3) onFailure();
          }}
          className="absolute select-none"
          style={{ left: tile.left, top: tile.top, width: TILE, height: TILE }}
        />
      ))}
    </div>
  );
}

export interface JourneyMapProps {
  origin: Coordinates;
  destination: Coordinates;
  originLabel: string;
  destinationLabel: string;
  /** Rendered when no real tiles can be shown. */
  fallback?: React.ReactNode;
  className?: string;
  height?: number;
}

export function JourneyMap({
  origin,
  destination,
  originLabel,
  destinationLabel,
  fallback = null,
  className = "",
  height = 300,
}: JourneyMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The route draws once the frame is real, so the animation starts from a
  // known geometry rather than from a zero-width first paint.
  useEffect(() => {
    if (width <= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    const t = window.setTimeout(() => setDrawn(true), 120);
    return () => window.clearTimeout(t);
  }, [width, origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

  const km = useMemo(() => distanceKm(origin, destination), [origin, destination]);
  const heading = useMemo(() => bearingBetween(origin, destination), [origin, destination]);

  const frame = useMemo(
    () => (width > 0 ? buildFrame(origin, destination, width, height) : null),
    [width, height, origin, destination]
  );

  const googleSrc = useMemo(() => {
    if (!MAPS_KEY || width <= 0 || !frame) return null;
    const size = `${Math.min(640, Math.round(width))}x${height}`;
    const path = `color:0xa3e635ff|weight:4|${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`;
    return (
      "https://maps.googleapis.com/maps/api/staticmap" +
      `?size=${size}&scale=2&maptype=roadmap` +
      `&path=${encodeURIComponent(path)}` +
      `&markers=${encodeURIComponent(`color:0x7ce7b0|label:A|${origin.latitude},${origin.longitude}`)}` +
      `&markers=${encodeURIComponent(`color:0xa3e635|label:B|${destination.latitude},${destination.longitude}`)}` +
      "&style=" + encodeURIComponent("feature:all|element:geometry|color:0x0b1116") +
      "&style=" + encodeURIComponent("feature:all|element:labels.text.fill|color:0x8b9aa5") +
      "&style=" + encodeURIComponent("feature:all|element:labels.text.stroke|color:0x0b1116") +
      "&style=" + encodeURIComponent("feature:road|element:geometry|color:0x1c2a33") +
      "&style=" + encodeURIComponent("feature:water|element:geometry|color:0x08161c") +
      `&key=${encodeURIComponent(MAPS_KEY)}`
    );
  }, [frame, width, height, origin, destination]);

  const a = frame?.toScreen(origin);
  const b = frame?.toScreen(destination);

  // A gentle arc rather than a dead-straight chord: the same two endpoints,
  // bowed perpendicular to the corridor so the line reads as travel.
  const corridor = useMemo(() => {
    if (!a || !b) return null;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(46, len * 0.16);
    return {
      d: `M ${a.x} ${a.y} Q ${mx + (-dy / len) * bow} ${my + (dx / len) * bow} ${b.x} ${b.y}`,
      length: len + bow,
    };
  }, [a, b]);

  if (tilesFailed && !googleSrc && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={`overflow-hidden rounded-[22px] border border-white/[0.08] ${className}`}
      style={{ background: "linear-gradient(180deg, rgba(9,17,22,0.95), rgba(5,10,16,0.9))" }}
    >
      {/* ── Navigation strip ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[22px] font-bold leading-none text-lime-200">
            {formatDistance(km)?.replace(" away", "")}
          </span>
          <span className="text-[13px] text-white/45">· {travelEstimate(km)}</span>
        </div>
        <span className="rh-mono inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-white/35">
          <Navigation className="h-3 w-3 text-lime-300/70" />
          HEAD {compassOf(heading)} · {Math.round(heading)}°
        </span>
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {googleSrc ? (
          <img
            src={googleSrc}
            alt={`Map of the route to ${destinationLabel}`}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setTilesFailed(true)}
          />
        ) : frame ? (
          <TileLayer
            frame={frame}
            width={width}
            height={height}
            onFailure={() => setTilesFailed(true)}
          />
        ) : null}

        {/* ReHome's own overlay — the corridor and both ends. */}
        {a && b && corridor && !googleSrc ? (
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="rh-journey" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7ce7b0" />
                <stop offset="100%" stopColor="#a3e635" />
              </linearGradient>
              <filter id="rh-journey-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Casing under the line, the way a route is drawn on a real map. */}
            <path d={corridor.d} fill="none" stroke="rgba(4,10,14,0.85)" strokeWidth="9" strokeLinecap="round" />
            <path
              d={corridor.d}
              fill="none"
              stroke="url(#rh-journey)"
              strokeWidth="4.5"
              strokeLinecap="round"
              filter="url(#rh-journey-glow)"
              style={{
                strokeDasharray: corridor.length,
                strokeDashoffset: drawn ? 0 : corridor.length,
                transition: "stroke-dashoffset 1400ms cubic-bezier(0.33,0.9,0.28,1)",
              }}
            />

            {/* Destination pin. */}
            <g transform={`translate(${b.x}, ${b.y})`}>
              <circle r="15" fill="rgba(163,230,53,0.16)" className="rh-journey-pulse" />
              <path
                d="M 0 2 C -8 -6 -11 -11 -11 -15 A 11 11 0 1 1 11 -15 C 11 -11 8 -6 0 2 Z"
                fill="#a3e635"
                stroke="rgba(4,10,14,0.7)"
                strokeWidth="1.5"
              />
              <circle cy="-15" r="4" fill="#06231a" />
            </g>

            {/* Origin: the familiar blue-dot idiom, in ReHome's palette. */}
            <g transform={`translate(${a.x}, ${a.y})`}>
              <circle r="17" fill="rgba(124,231,176,0.14)" />
              <circle r="7" fill="#7ce7b0" stroke="rgba(4,10,14,0.8)" strokeWidth="2.5" />
            </g>
          </svg>
        ) : null}

        {/* Labels, kept out of the SVG so they inherit the product's type. */}
        {a && b && !googleSrc ? (
          <>
            <span
              className="pointer-events-none absolute -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-full border border-white/10 bg-[#050a10]/85 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-sm"
              style={{ left: Math.min(Math.max(a.x, 60), width - 60), top: a.y + 12 }}
            >
              {originLabel}
            </span>
            <span
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full border border-lime-300/25 bg-[#050a10]/85 px-2.5 py-1 text-[11px] text-lime-100 backdrop-blur-sm"
              style={{
                left: Math.min(Math.max(b.x, 70), Math.max(70, width - 70)),
                top: Math.max(4, b.y - 46),
              }}
            >
              {destinationLabel}
            </span>
          </>
        ) : null}

        {/* Vignette, so the map sits inside ReHome's frame. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,10,16,0.5) 0%, transparent 22%, transparent 72%, rgba(5,10,16,0.75) 100%)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-white/[0.06] px-5 py-3">
        <p className="rh-mono text-[9.5px] leading-relaxed tracking-[0.16em] text-white/30">
          DIRECT CORRIDOR — NO ROUTING SERVICE CALLED · TIME IS AN ESTIMATE
        </p>
        <p className="text-[10px] text-white/25">
          {googleSrc ? "Map data © Google" : "© OpenStreetMap contributors"}
        </p>
      </div>
    </div>
  );
}
