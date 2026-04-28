"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { sampleOverlayColor } from "@/lib/overlay-sample";
import { CRIME_OVERLAY, loadStoredBounds } from "@/lib/overlay-config";
import { setOverride } from "@/lib/overlay-color-overrides";

interface Props {
  propertyId: string;
  onPicked: (hex: string) => void;
  onMissed: () => void;
}

export function OverlayColorPicker({ propertyId, onPicked, onMissed }: Props) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const prevCursor = container.style.cursor;
    container.style.cursor = "crosshair";
    return () => {
      container.style.cursor = prevCursor;
    };
  }, [map]);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const bounds = loadStoredBounds() ?? CRIME_OVERLAY.bounds;
      const hex = await sampleOverlayColor(
        lat,
        lng,
        CRIME_OVERLAY.imageUrl,
        bounds,
      );
      if (!hex) {
        onMissed();
        return;
      }
      setOverride(propertyId, hex);
      onPicked(hex);
    },
  });

  return null;
}
