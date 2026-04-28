// Driving time from a property to Montrose, via the OSRM public demo server.
// Cached in localStorage keyed by 4-decimal lat,lng so a pin nudge invalidates
// the entry but tiny float drift does not.

export const MONTROSE = {
  lat: 29.7423,
  lng: -95.3905,
} as const;

const CACHE_KEY = "condoSearch.travelToMontrose.v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CacheEntry = { minutes: number | null; computedAt: number };

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function readCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, CacheEntry>)
      : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota / privacy mode — ignore
  }
}

function saveEntry(lat: number, lng: number, minutes: number | null) {
  const cache = readCache();
  cache[cacheKey(lat, lng)] = { minutes, computedAt: Date.now() };
  writeCache(cache);
}

export function getCachedMinutes(
  lat: number,
  lng: number,
): number | null | undefined {
  const cache = readCache();
  const entry = cache[cacheKey(lat, lng)];
  if (!entry) return undefined;
  if (Date.now() - entry.computedAt > CACHE_TTL_MS) return undefined;
  return entry.minutes;
}

export async function fetchMinutesToMontrose(
  lat: number,
  lng: number,
): Promise<number | null> {
  const cached = getCachedMinutes(lat, lng);
  if (cached !== undefined) return cached;

  try {
    // OSRM expects lng,lat order in the path.
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${MONTROSE.lng},${MONTROSE.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) {
      saveEntry(lat, lng, null);
      return null;
    }
    const data = (await res.json()) as {
      routes?: Array<{ duration?: number }>;
    };
    const seconds = data.routes?.[0]?.duration;
    if (typeof seconds !== "number") {
      saveEntry(lat, lng, null);
      return null;
    }
    const minutes = Math.round(seconds / 60);
    saveEntry(lat, lng, minutes);
    return minutes;
  } catch {
    return null;
  }
}
