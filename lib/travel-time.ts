// Driving time from a property to a user-configurable destination, via the
// OSRM public demo server. Cached in localStorage keyed by destination + property
// coords so changing the destination fetches fresh times without nuking old ones.

export type Destination = { label: string; lat: number; lng: number };

export const MONTROSE: Destination = {
  label: "Montrose",
  lat: 29.7423,
  lng: -95.3905,
};

const DEST_KEY = "condoSearch.commuteDest.v1";
const CACHE_KEY = "condoSearch.travelTime.v2";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getCommuteDest(): Destination {
  if (typeof window === "undefined") return MONTROSE;
  try {
    const raw = window.localStorage.getItem(DEST_KEY);
    if (!raw) return MONTROSE;
    const parsed = JSON.parse(raw) as Destination;
    if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number" && parsed.label) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return MONTROSE;
}

export function saveCommuteDest(dest: Destination) {
  try {
    window.localStorage.setItem(DEST_KEY, JSON.stringify(dest));
  } catch {
    // quota / privacy mode
  }
}

type CacheEntry = { minutes: number | null; computedAt: number };

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function cacheKey(propLat: number, propLng: number, dest: Destination): string {
  return `${coordKey(dest.lat, dest.lng)}|${coordKey(propLat, propLng)}`;
}

function readCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota / privacy mode
  }
}

function saveEntry(propLat: number, propLng: number, dest: Destination, minutes: number | null) {
  const cache = readCache();
  cache[cacheKey(propLat, propLng, dest)] = { minutes, computedAt: Date.now() };
  writeCache(cache);
}

export function getCachedMinutes(
  lat: number,
  lng: number,
  dest: Destination = getCommuteDest(),
): number | null | undefined {
  const cache = readCache();
  const entry = cache[cacheKey(lat, lng, dest)];
  if (!entry) return undefined;
  if (Date.now() - entry.computedAt > CACHE_TTL_MS) return undefined;
  return entry.minutes;
}

export async function fetchMinutesToMontrose(
  lat: number,
  lng: number,
  dest: Destination = getCommuteDest(),
): Promise<number | null> {
  const cached = getCachedMinutes(lat, lng, dest);
  if (cached !== undefined) return cached;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) {
      saveEntry(lat, lng, dest, null);
      return null;
    }
    const data = (await res.json()) as {
      routes?: Array<{ duration?: number }>;
    };
    const seconds = data.routes?.[0]?.duration;
    if (typeof seconds !== "number") {
      saveEntry(lat, lng, dest, null);
      return null;
    }
    const minutes = Math.round(seconds / 60);
    saveEntry(lat, lng, dest, minutes);
    return minutes;
  } catch {
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<Destination | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data[0]) return null;
    return {
      label: data[0].display_name.split(",")[0].trim(),
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
