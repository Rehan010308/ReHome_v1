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

/** Real geometry, drawn. Not a stand-in for a map — a diagram of what we know. */
function RouteDiagram({ from, to, km }: { from: Coordinates | null; to: Coordinates; km: number | null }) {
  const angle = from ? bearing(from, to) : 0;

  return (
    <svg viewBox="0 0 400 220" className="h-full w-full" role="img" aria-label="Route overview">
      <defs>
        <linearGradient id="rh-route" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7ce7b0" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#a3e635" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="rh-halo">
          <stop offset="0%" stopColor="#a3e635" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground grid, fading toward the horizon. */}
      {Array.from({ length: 7 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1="0" x2="400"
          y1={70 + i * 25} y2={70 + i * 25}
          stroke="rgba(190,255,220,0.07)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={i * 50} x2={i * 50}
          y1="70" y2="220"
          stroke="rgba(190,255,220,0.05)"
          strokeWidth="1"
        />
      ))}

      <path
        d="M 70 165 Q 200 60 330 120"
        fill="none"
        stroke="url(#rh-route)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {from ? (
        <>
          <circle cx="70" cy="165" r="26" fill="url(#rh-halo)" />
          <circle cx="70" cy="165" r="4.5" fill="#7ce7b0" />
          <text x="70" y="192" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="11">
            You
          </text>
        </>
      ) : null}

      <circle cx="330" cy="120" r="30" fill="url(#rh-halo)" />
      <circle cx="330" cy="120" r="6" fill="#a3e635" />
      <circle cx="330" cy="120" r="13" fill="none" stroke="#a3e635" strokeOpacity="0.4" strokeWidth="1.5" />
      <text x="330" y="150" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11">
        Destination
      </text>

      {km !== null && from ? (
        <g transform="translate(200, 92)">
          <text textAnchor="middle" fill="#a3e635" fontSize="15" fontWeight="600">
            {formatDistance(km)?.replace(" away", "")}
          </text>
          <text y="16" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">
            bearing {Math.round((angle + 360) % 360)}°
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
  className = "",
}: {
  destination: { latitude: number | null; longitude: number | null };
  origin?: { latitude: number | null; longitude: number | null } | null;
  organizationName: string;
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
          <RouteDiagram from={from} to={to} km={km} />
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
        </p>
        {km !== null ? (
          <p className="inline-flex items-center gap-2 text-[13px] text-white/45">
            <Navigation className="h-3.5 w-3.5 text-lime-300/70" />
            {formatDistance(km)?.replace(" away", "")} — {travelEstimate(km)}
            <span className="text-white/25">estimated</span>
          </p>
        ) : (
          <p className="text-[13px] text-white/35">Add a location to see distance</p>
        )}
      </div>
    </div>
  );
}
