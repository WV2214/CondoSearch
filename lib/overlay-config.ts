// Bounds are [southWestLat, southWestLng, northEastLat, northEastLng]
// Replace these with real values produced by /admin/overlay-setup after capturing
// the CrimeGrade.org screenshot for Houston.
export const CRIME_OVERLAY = {
  imageUrl: "/overlays/crimegrade-houston.png",
  bounds: [29.55, -95.75, 29.95, -95.05] as [number, number, number, number],
  autoHideZoomThreshold: 15,
};
