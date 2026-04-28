// Bounds are [southWestLat, southWestLng, northEastLat, northEastLng]
// Replace these with real values produced by /admin/overlay-setup after capturing
// the CrimeGrade.org screenshot for Houston.
export const CRIME_OVERLAY = {
  imageUrl: "/overlays/crimegrade-houston.png",
  bounds: [29.677244, -95.660312, 29.832866, -95.349284] as [number, number, number, number],
  autoHideZoomThreshold: 15,
};
