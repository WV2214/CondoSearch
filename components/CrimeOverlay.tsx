"use client";

import { ImageOverlay, useMap, useMapEvents } from "react-leaflet";
import { useState } from "react";
import { CRIME_OVERLAY, type Bounds } from "@/lib/overlay-config";

interface Props {
  forceVisible: boolean | null;
  bounds: Bounds;
  opacity: number;
  ignoreZoomAutoHide?: boolean;
}

export function CrimeOverlay({
  forceVisible,
  bounds,
  opacity,
  ignoreZoomAutoHide = false,
}: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const auto = zoom <= CRIME_OVERLAY.autoHideZoomThreshold;
  const visible = ignoreZoomAutoHide ? true : (forceVisible ?? auto);
  if (!visible) return null;

  const [s, w, n, e] = bounds;
  return (
    <ImageOverlay
      url={CRIME_OVERLAY.imageUrl}
      bounds={[
        [s, w],
        [n, e],
      ]}
      opacity={opacity}
    />
  );
}
