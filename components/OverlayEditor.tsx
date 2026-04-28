"use client";

import { Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";
import type { Bounds } from "@/lib/overlay-config";

interface Props {
  bounds: Bounds;
  onChange: (b: Bounds) => void;
}

type CornerKey = "nw" | "ne" | "se" | "sw";

const cornerIcon = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#facc15;
    border:3px solid #0a0a0a;
    box-shadow:0 0 0 2px #facc15, 0 2px 6px rgba(0,0,0,0.6);
    cursor:grab;
    pointer-events:auto;
  "></div>`,
});

const centerIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:#fafafa;
    border:3px solid #0a0a0a;
    box-shadow:0 0 0 2px #fafafa, 0 2px 6px rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;
    font-size:13px;color:#0a0a0a;font-weight:bold;
    cursor:grab;
    pointer-events:auto;
  ">✥</div>`,
});

export function OverlayEditor({ bounds, onChange }: Props) {
  const [s, w, n, e] = bounds;

  const corners: Record<CornerKey, [number, number]> = useMemo(
    () => ({
      nw: [n, w],
      ne: [n, e],
      se: [s, e],
      sw: [s, w],
    }),
    [s, w, n, e],
  );

  const center: [number, number] = [(s + n) / 2, (w + e) / 2];

  const handleCornerDragEnd = (key: CornerKey, ev: L.LeafletEvent) => {
    const ll = (ev.target as L.Marker).getLatLng();
    let ns = s;
    let nw_ = w;
    let nn = n;
    let ne_ = e;
    switch (key) {
      case "nw":
        nn = ll.lat;
        nw_ = ll.lng;
        break;
      case "ne":
        nn = ll.lat;
        ne_ = ll.lng;
        break;
      case "se":
        ns = ll.lat;
        ne_ = ll.lng;
        break;
      case "sw":
        ns = ll.lat;
        nw_ = ll.lng;
        break;
    }
    if (nn < ns) [nn, ns] = [ns, nn];
    if (ne_ < nw_) [ne_, nw_] = [nw_, ne_];
    onChange([ns, nw_, nn, ne_]);
  };

  const handleCenterDragEnd = (ev: L.LeafletEvent) => {
    const ll = (ev.target as L.Marker).getLatLng();
    const oldCenterLat = (s + n) / 2;
    const oldCenterLng = (w + e) / 2;
    const dLat = ll.lat - oldCenterLat;
    const dLng = ll.lng - oldCenterLng;
    onChange([s + dLat, w + dLng, n + dLat, e + dLng]);
  };

  return (
    <>
      <Polyline
        positions={[
          [n, w],
          [n, e],
          [s, e],
          [s, w],
          [n, w],
        ]}
        pathOptions={{
          color: "#facc15",
          weight: 2,
          dashArray: "6 4",
          opacity: 0.9,
          interactive: false,
        }}
      />
      {(["nw", "ne", "se", "sw"] as CornerKey[]).map((key) => (
        <Marker
          key={key}
          position={corners[key]}
          draggable
          icon={cornerIcon}
          eventHandlers={{
            dragend: (ev) => handleCornerDragEnd(key, ev),
          }}
        />
      ))}
      <Marker
        position={center}
        draggable
        icon={centerIcon}
        eventHandlers={{
          dragend: handleCenterDragEnd,
        }}
      />
    </>
  );
}
