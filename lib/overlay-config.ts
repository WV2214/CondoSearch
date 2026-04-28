// Bounds are [southWestLat, southWestLng, northEastLat, northEastLng]
// Calibrate via /admin/overlay-setup or via the in-place editor on the main map page.
// The editor saves to localStorage; copy the printed line back into this file
// so the bounds also work on other devices and after a fresh deploy.
export type Bounds = [number, number, number, number];

export const CRIME_OVERLAY = {
  imageUrl: "/overlays/crimegrade-houston.png",
  bounds: [
    29.677244, -95.660312, 29.832866, -95.349284,
  ] as Bounds,
  autoHideZoomThreshold: 15,
};

export const OVERLAY_BOUNDS_STORAGE_KEY = "condoSearch.overlayBounds.v1";
export const OVERLAY_OPACITY_STORAGE_KEY = "condoSearch.overlayOpacity.v1";
export const DEFAULT_OVERLAY_OPACITY = 0.85;

export function loadStoredOpacity(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OVERLAY_OPACITY_STORAGE_KEY);
    if (!raw) return null;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  } catch {
    // Fallthrough
  }
  return null;
}

export function saveStoredOpacity(opacity: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    OVERLAY_OPACITY_STORAGE_KEY,
    String(opacity),
  );
}

export function loadStoredBounds(): Bounds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OVERLAY_BOUNDS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      parsed.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      return parsed as Bounds;
    }
  } catch {
    // Fallthrough to null
  }
  return null;
}

export function saveStoredBounds(bounds: Bounds) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    OVERLAY_BOUNDS_STORAGE_KEY,
    JSON.stringify(bounds),
  );
}

export function clearStoredBounds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OVERLAY_BOUNDS_STORAGE_KEY);
}
