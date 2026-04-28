"use client";

import { ImageOverlay, useMap, useMapEvents } from "react-leaflet";
import { useState } from "react";
import { CRIME_OVERLAY } from "@/lib/overlay-config";

export function CrimeOverlay({
  forceVisible,
}: {
  forceVisible: boolean | null;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const auto = zoom <= CRIME_OVERLAY.autoHideZoomThreshold;
  const visible = forceVisible ?? auto;
  if (!visible) return null;

  const [s, w, n, e] = CRIME_OVERLAY.bounds;
  return (
    <ImageOverlay
      url={CRIME_OVERLAY.imageUrl}
      bounds={[
        [s, w],
        [n, e],
      ]}
      opacity={0.65}
    />
  );
}
