/**
 * Geospatial layer.
 *
 * Coordinates are the source of truth. PostGIS does the heavy spatial work
 * server-side (see nearby_requirements), and everything here is the client-side
 * complement: acquiring a position, reducing its precision for privacy, and
 * computing distance locally when a server round-trip isn't warranted or
 * PostGIS is unavailable.
 *
 * No external geocoding provider is required for the system to function.
 * resolveLocality() uses a keyless reverse-geocoder to turn a coordinate into a
 * place name, and when it cannot answer the app degrades to the coordinates it
 * actually holds, rather than breaking or inventing place names.
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
 * What the browser will do if we ask for a position right now.
 *
 * Lets a caller tell three cases apart without triggering a prompt: already
 * granted (ask silently), not yet decided (asking is reasonable, and the
 * browser shows its own dialog), and refused (do not ask again — fall back and
 * say so). Browsers without the Permissions API report "prompt", which is the
 * safe assumption.
 */
export async function geolocationPermission(): Promise<"granted" | "prompt" | "denied"> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "prompt";
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state as "granted" | "prompt" | "denied";
  } catch {
    return "prompt";
  }
}

/** A place name for a coordinate, as reported by a real geocoder. */
export interface Locality {
  /** What to show the user, e.g. "Vellore, Tamil Nadu". */
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Coordinates, written the way a person reads them. This is the honest
 * fallback when no geocoder answers: it is still the user's actual location,
 * just expressed as the numbers we genuinely hold, rather than a place name we
 * would be inventing.
 */
export function formatCoordinates(c: Coordinates): string {
  const lat = `${Math.abs(c.latitude).toFixed(2)}°${c.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(c.longitude).toFixed(2)}°${c.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/**
 * Reverse geocoding, via BigDataCloud's client-side endpoint.
 *
 * Chosen because it needs no key: nothing secret is shipped to the browser,
 * which is the constraint that kept this a stub before. Only the already
 * blurred coordinate is sent, never an exact position.
 *
 * Returning null is a valid answer and every caller must handle it — the
 * product never blocks on a third-party lookup, and it never invents a place
 * name when the lookup fails.
 */
export async function resolveLocality(
  c: Coordinates,
  timeoutMs = 6_000
): Promise<Locality | null> {
  if (typeof fetch === "undefined") return null;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client" +
      `?latitude=${encodeURIComponent(c.latitude)}` +
      `&longitude=${encodeURIComponent(c.longitude)}` +
      "&localityLanguage=en";

    const response = await fetch(url, { signal: controller?.signal });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };

    const city = (body.city || body.locality || "").trim() || null;
    const region = (body.principalSubdivision ?? "").trim() || null;
    const country = (body.countryName ?? "").trim() || null;

    const label = [city, region].filter(Boolean).join(", ") || country;
    if (!label) return null;

    return { label, city, region, country };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
