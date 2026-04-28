export interface GeocodeCandidate {
  latitude: number;
  longitude: number;
  confidence: "high" | "low";
  displayName: string;
}

type NominatimRow = {
  lat: string;
  lon: string;
  importance: number;
  display_name: string;
};

// Bidirectional pairs. The matcher is case-insensitive and tolerates a trailing period.
const ABBREVIATIONS: Array<[string, string]> = [
  ["st", "street"],
  ["ave", "avenue"],
  ["av", "avenue"],
  ["blvd", "boulevard"],
  ["rd", "road"],
  ["dr", "drive"],
  ["ln", "lane"],
  ["ct", "court"],
  ["cir", "circle"],
  ["ter", "terrace"],
  ["pl", "place"],
  ["pkwy", "parkway"],
  ["hwy", "highway"],
  ["plz", "plaza"],
  ["plz", "park"],
  ["plz", "place"],
  ["pk", "park"],
  ["sq", "square"],
  ["trl", "trail"],
  ["xing", "crossing"],
  ["cres", "crescent"],
  ["frwy", "freeway"],
  ["expy", "expressway"],
  ["aly", "alley"],
  ["mt", "mount"],
  ["mtn", "mountain"],
  ["n", "north"],
  ["s", "south"],
  ["e", "east"],
  ["w", "west"],
  ["ne", "northeast"],
  ["nw", "northwest"],
  ["se", "southeast"],
  ["sw", "southwest"],
];

function stripUnit(address: string): string {
  // Nominatim can't resolve unit/apartment designators — strip them before retrying.
  return address
    .replace(/,?\s*(unit|apt\.?|apartment|suite|ste\.?|#)\s*[\w-]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokenVariants(token: string): string[] {
  // Prefer expansions first so the fully-expanded address is the first variant tried.
  const stripped = token.replace(/\.$/, "");
  const lower = stripped.toLowerCase();
  const out: string[] = [];
  for (const [short, long] of ABBREVIATIONS) {
    if (lower === short) out.push(matchCase(stripped, long));
    if (lower === long) out.push(matchCase(stripped, short));
  }
  out.push(token);
  return [...new Set(out)];
}

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target;
}

function dropHouseNumber(address: string): string | null {
  const match = address.match(/^\s*\d+[A-Za-z]?\s+(.+)/);
  if (!match) return null;
  return match[1];
}

function extractZipCity(address: string): string | null {
  // Match "City, ST 12345" near the end of the string.
  const match = address.match(
    /([A-Za-z][A-Za-z .'-]*?)\s*,\s*([A-Z]{2})\s+(\d{5})\b/,
  );
  if (!match) return null;
  return `${match[3]}, ${match[1].trim()}, ${match[2]}`;
}

function generateAddressVariants(address: string, max = 24): string[] {
  // Split keeping whitespace and comma separators so we can rejoin verbatim.
  const parts = address.split(/(\s+|,)/);
  const variantArrays = parts.map((p) => {
    if (p === "" || /^\s+$/.test(p) || p === ",") return [p];
    return tokenVariants(p);
  });

  const results: string[] = [];
  const recurse = (idx: number, acc: string) => {
    if (results.length >= max) return;
    if (idx === variantArrays.length) {
      results.push(acc);
      return;
    }
    for (const v of variantArrays[idx]) {
      recurse(idx + 1, acc + v);
      if (results.length >= max) return;
    }
  };
  recurse(0, "");
  return results;
}

async function fetchNominatim(
  address: string,
  limit = 5,
): Promise<NominatimRow[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "CondoSearch/1.0 (personal project)",
        "Accept-Language": "en-US,en",
      },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  return (await res.json()) as NominatimRow[];
}

function rowToCandidate(row: NominatimRow): GeocodeCandidate | null {
  const latitude = parseFloat(row.lat);
  const longitude = parseFloat(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    confidence: row.importance >= 0.4 ? "high" : "low",
    displayName: row.display_name,
  };
}

function dedupeKey(c: GeocodeCandidate): string {
  return `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`;
}

export async function geocodeAddressMulti(
  address: string,
): Promise<GeocodeCandidate[]> {
  const tried = new Set<string>();
  const seen = new Set<string>();
  const candidates: GeocodeCandidate[] = [];

  const tryQuery = async (q: string) => {
    const norm = q.trim().replace(/\s+/g, " ");
    if (!norm) return;
    const key = norm.toLowerCase();
    if (tried.has(key)) return;
    tried.add(key);
    const rows = await fetchNominatim(norm);
    for (const row of rows) {
      const c = rowToCandidate(row);
      if (!c) continue;
      const k = dedupeKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      candidates.push(c);
    }
  };

  await tryQuery(address);

  const stripped = stripUnit(address);
  if (candidates.length === 0 && stripped !== address) {
    await tryQuery(stripped);
  }

  if (candidates.length === 0) {
    const variants = generateAddressVariants(stripped, 24);
    for (const v of variants) {
      await tryQuery(v);
      if (candidates.length > 0) break;
    }
  }

  // Fallback 1: drop the leading house number, retry with abbreviation variants.
  // Useful when Nominatim has the street but not the specific address.
  if (candidates.length === 0) {
    const noHouseNumber = dropHouseNumber(stripped);
    if (noHouseNumber) {
      const variants = generateAddressVariants(noHouseNumber, 24);
      for (const v of variants) {
        await tryQuery(v);
        if (candidates.length > 0) break;
      }
    }
  }

  // Fallback 2: ZIP + city centroid. Last-resort drop-pin for the right
  // neighborhood when even the street can't be resolved.
  if (candidates.length === 0) {
    const zipCity = extractZipCity(stripped);
    if (zipCity) await tryQuery(zipCity);
  }

  candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return 0;
  });
  return candidates;
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodeCandidate | null> {
  const candidates = await geocodeAddressMulti(address);
  return candidates[0] ?? null;
}
