"use client";

import { useEffect, useState } from "react";
import { sampleOverlayColor } from "@/lib/overlay-sample";
import { CRIME_OVERLAY, loadStoredBounds } from "@/lib/overlay-config";
import {
  getOverride,
  subscribeOverrides,
} from "@/lib/overlay-color-overrides";

interface Props {
  lat: number;
  lng: number;
  size?: number;
  propertyId?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
}

export function OverlayColorSwatch({
  lat,
  lng,
  size = 10,
  propertyId,
  onClick,
  onContextMenu,
  active = false,
}: Props) {
  const [autoColor, setAutoColor] = useState<string | null>(null);
  const [override, setOverrideState] = useState<string | null>(
    propertyId ? getOverride(propertyId) : null,
  );

  useEffect(() => {
    const bounds = loadStoredBounds() ?? CRIME_OVERLAY.bounds;
    sampleOverlayColor(lat, lng, CRIME_OVERLAY.imageUrl, bounds).then(
      setAutoColor,
    );
  }, [lat, lng]);

  useEffect(() => {
    if (!propertyId) return;
    setOverrideState(getOverride(propertyId));
    return subscribeOverrides(() => {
      setOverrideState(getOverride(propertyId));
    });
  }, [propertyId]);

  const color = override ?? autoColor;
  const half = size / 2;
  const radius = `${half}px`;
  const interactive = Boolean(onClick || onContextMenu);

  const baseStyle: React.CSSProperties = {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    cursor: interactive ? "pointer" : "default",
  };

  if (active) baseStyle.boxShadow = "0 0 0 2px #fde047";

  if (color === null) {
    return (
      <span
        title={
          active
            ? "Click on the overlay to set this property's color"
            : interactive
              ? "Crime overlay: out of range — click to pick a color"
              : "Crime overlay: out of range"
        }
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{
          ...baseStyle,
          border: "1.5px solid #52525b",
        }}
      />
    );
  }

  const tip = override
    ? `Crime overlay (manual): ${color} — right-click to clear`
    : interactive
      ? `Crime overlay: ${color} — click to override`
      : `Crime overlay: ${color}`;

  return (
    <span
      title={tip}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        ...baseStyle,
        background: color,
        border: "1.5px solid rgba(0,0,0,0.35)",
      }}
    />
  );
}
