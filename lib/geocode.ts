interface GeocodeResult {
  latitude: number;
  longitude: number;
  confidence: "high" | "low";
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
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
    return null;
  }
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{
    lat: string;
    lon: string;
    importance: number;
  }>;
  if (!arr.length) return null;
  const top = arr[0];
  const latitude = parseFloat(top.lat);
  const longitude = parseFloat(top.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const confidence: "high" | "low" = top.importance >= 0.4 ? "high" : "low";
  return { latitude, longitude, confidence };
}
