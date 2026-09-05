/**
 * Geospatial layer.
 *
 * Coordinates are the source of truth. PostGIS does the heavy spatial work
 * server-side (see nearby_requirements), and everything here is the client-side
 * complement: acquiring a position, reducing its precision for privacy, and
 * computing distance locally when a server round-trip isn't warranted or
 * PostGIS is unavailable.
 *
 * No external geocoding provider is required for the system to function. One
 * can be layered on later behind resolveLocality(); until then the app degrades
 * to coordinates plus whatever locality text the user supplies, rather than
 * breaking or inventing place names.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationPrecision = "exact" | "area" | "city";

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance. Matches ST_Distance on a sphere closely enough for
 * ranking and display; PostGIS remains authoritative for spatial queries.
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rounding grid, in decimal degrees, per precision level.
 *   exact — as given (only with explicit consent)
 *   area  — ~1.1 km grid, enough to say "2.4 km away" without locating a home
 *   city  — ~11 km grid
 */
const GRID: Record<LocationPrecision, number> = {
  exact: 0,
  area: 0.01,
  city: 0.1,
};

/**
 * Reduce a coordinate's precision before it is stored or shared. A donor's
 * exact address must never reach another user; distance is derived from the
 * blurred point, which is accurate enough for routing decisions.
 */
export function blurCoordinates(c: Coordinates, precision: LocationPrecision): Coordinates {
  const grid = GRID[precision];
  if (!grid) return c;
  const snap = (v: number) => Math.round(v / grid) * grid;
  return {
    latitude: Number(snap(c.latitude).toFixed(6)),
    longitude: Number(snap(c.longitude).toFixed(6)),
  };
}

/** Human distance. Deliberately coarse — false precision implies false knowledge. */
export function formatDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

export function coordsOf(row: {
  latitude?: number | null;
  longitude?: number | null;
}): Coordinates | null {
  if (row.latitude === null || row.latitude === undefined) return null;
  if (row.longitude === null || row.longitude === undefined) return null;
  return { latitude: row.latitude, longitude: row.longitude };
}

export class GeolocationUnavailable extends Error {}

/**
 * Browser geolocation, wrapped so callers get a typed failure instead of a
 * PositionError. Location is always optional in ReHome — a donor who declines
 * still gets matches, just without proximity ranking.
 */
export async function requestPosition(timeoutMs = 10_000): Promise<Coordinates> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new GeolocationUnavailable("This browser cannot share a location.");
  }
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) =>
        reject(
          new GeolocationUnavailable(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was declined."
              : "Could not determine your location."
          )
        ),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 }
    );
  });
}

/**
 * Seam for a future geocoding provider. Returning null is a valid answer and
 * callers must handle it — the product never blocks on a third-party lookup,
 * and any provider key would live server-side, never in VITE_ env vars.
 */
export async function resolveLocality(_c: Coordinates): Promise<string | null> {
  return null;
}
