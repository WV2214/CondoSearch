"use client";

import { Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { useMemo, useRef } from "react";
import type { Bounds } from "@/lib/overlay-config";

interface Props {
  bounds: Bounds;
  onChange: (b: Bounds) => void;
}

type CornerKey = "nw" | "ne" | "se" | "sw";

const cornerIcon = (color: string) =>
  L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};
      border:2px solid #0a0a0a;
      box-shadow:0 0 0 2px ${color};
    "></div>`,
  });

const centerIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:#fafafa;
    border:2px solid #0a0a0a;
    box-shadow:0 0 0 2px #fafafa;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;color:#0a0a0a;font-weight:bold;
  ">✥</div>`,
});

export function OverlayEditor({ bounds, onChange }: Props) {
  const [s, w, n, e] = bounds;
  const cornerColor = "#facc15";

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
  const dragStart = useRef<{ lat: number; lng: number } | null>(null);

  const updateCorner = (key: CornerKey, lat: number, lng: number) => {
    let ns = s,
      nw_ = w,
      nn = n,
      ne_ = e;
    switch (key) {
      case "nw":
        nn = lat;
        nw_ = lng;
        break;
      case "ne":
        nn = lat;
        ne_ = lng;
        break;
      case "se":
        ns = lat;
        ne_ = lng;
        break;
      case "sw":
        ns = lat;
        nw_ = lng;
        break;
    }
    // Keep n > s and e > w
    if (nn < ns) [nn, ns] = [ns, nn];
    if (ne_ < nw_) [ne_, nw_] = [nw_, ne_];
    onChange([ns, nw_, nn, ne_]);
  };

  const onCenterDragStart = (e: L.LeafletEvent) => {
    const ll = (e.target as L.Marker).getLatLng();
    dragStart.current = { lat: ll.lat, lng: ll.lng };
  };

  const onCenterDrag = (ev: L.LeafletEvent) => {
    if (!dragStart.current) return;
    const ll = (ev.target as L.Marker).getLatLng();
    const dLat = ll.lat - dragStart.current.lat;
    const dLng = ll.lng - dragStart.current.lng;
    onChange([s + dLat, w + dLng, n + dLat, e + dLng]);
    dragStart.current = { lat: ll.lat, lng: ll.lng };
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
          color: cornerColor,
          weight: 2,
          dashArray: "6 4",
          opacity: 0.9,
        }}
      />
      {(["nw", "ne", "se", "sw"] as CornerKey[]).map((key) => (
        <Marker
          key={key}
          position={corners[key]}
          draggable
          icon={cornerIcon(cornerColor)}
          eventHandlers={{
            drag: (ev) => {
              const ll = (ev.target as L.Marker).getLatLng();
              updateCorner(key, ll.lat, ll.lng);
            },
          }}
        />
      ))}
      <Marker
        position={center}
        draggable
        icon={centerIcon}
        eventHandlers={{
          dragstart: onCenterDragStart,
          drag: onCenterDrag,
        }}
      />
    </>
  );
}
