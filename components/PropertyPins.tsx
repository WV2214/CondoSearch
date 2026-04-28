"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";
import { OverlayColorSwatch } from "./OverlayColorSwatch";
import { sampleOverlayColor } from "@/lib/overlay-sample";
import { CRIME_OVERLAY, loadStoredBounds } from "@/lib/overlay-config";
import {
  getOverride,
  subscribeOverrides,
} from "@/lib/overlay-color-overrides";

const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#71717a",
  called: "#fb923c",
  scheduled: "#60a5fa",
  toured: "#4ade80",
  rejected: "#f87171",
  top_pick: "#facc15",
};

const NO_CRIME_COLOR = "#3f3f46";

function pinIcon(crimeColor: string, statusColor: string, dragging: boolean) {
  const border = dragging
    ? "2px dashed #fde047"
    : "2px solid #0a0a0a";
  const shadow = dragging ? "box-shadow:0 0 0 3px rgba(253,224,71,0.45);" : "";
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;border:${border};${shadow}overflow:hidden;display:flex;"><div style="width:50%;height:100%;background:${crimeColor};"></div><div style="width:50%;height:100%;background:${statusColor};"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function PropertyPins({
  properties,
  onMoved,
}: {
  properties: Property[];
  onMoved: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, [number, number]>
  >({});
  const [crimeColors, setCrimeColors] = useState<Record<string, string>>({});
  const [overrideTick, setOverrideTick] = useState(0);

  useEffect(() => {
    return subscribeOverrides(() => setOverrideTick((n) => n + 1));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bounds = loadStoredBounds() ?? CRIME_OVERLAY.bounds;
    const next: Record<string, string> = {};
    Promise.all(
      properties.map(async (p) => {
        const override = getOverride(p.id);
        if (override) {
          next[p.id] = override;
          return;
        }
        const pos = overrides[p.id];
        const lat = pos?.[0] ?? p.latitude;
        const lng = pos?.[1] ?? p.longitude;
        const sampled = await sampleOverlayColor(
          lat,
          lng,
          CRIME_OVERLAY.imageUrl,
          bounds,
        );
        if (sampled) next[p.id] = sampled;
      }),
    ).then(() => {
      if (!cancelled) setCrimeColors(next);
    });
    return () => {
      cancelled = true;
    };
  }, [properties, overrides, overrideTick]);

  const cancelEdit = (id: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingId(null);
  };

  const handleDragEnd = async (id: string, lat: number, lng: number) => {
    setOverrides((prev) => ({ ...prev, [id]: [lat, lng] }));
    try {
      await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      onMoved();
    } finally {
      setEditingId(null);
    }
  };

  return (
    <>
      {properties.map((p) => {
        const isEditing = editingId === p.id;
        const override = overrides[p.id];
        const lat = override?.[0] ?? p.latitude;
        const lng = override?.[1] ?? p.longitude;
        return (
          <Marker
            key={p.id}
            position={[lat, lng]}
            draggable={isEditing}
            icon={pinIcon(
              crimeColors[p.id] ?? NO_CRIME_COLOR,
              STATUS_COLOR[p.tour_status],
              isEditing,
            )}
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                handleDragEnd(p.id, ll.lat, ll.lng);
              },
            }}
          >
            <Popup>
              <div className="space-y-2 w-56 text-zinc-100">
                {p.photo_path && (
                  <img
                    src={publicPhotoUrl(p.photo_path)}
                    alt={p.address}
                    className="w-full h-32 object-cover rounded"
                  />
                )}
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.address}</span>
                  <OverlayColorSwatch
                    lat={lat}
                    lng={lng}
                    size={10}
                    propertyId={p.id}
                  />
                </div>
                <div className="text-sm text-zinc-300">
                  {p.price ? `$${p.price.toLocaleString()}/mo` : "Price unknown"}
                  {p.beds != null && ` · ${p.beds}bd`}
                  {p.baths != null && ` ${p.baths}ba`}
                </div>
                {p.star_rating && (
                  <div className="text-sm text-amber-300">
                    {"★".repeat(p.star_rating)}
                  </div>
                )}
                {isEditing ? (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs text-amber-300">
                      Drag the pin to move it. Drop to save.
                    </div>
                    <button
                      onClick={() => cancelEdit(p.id)}
                      className="w-full border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-xs hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    {p.listing_urls[0] && (
                      <a
                        href={p.listing_urls[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center bg-zinc-100 text-zinc-900 rounded px-2 py-1 text-xs font-medium"
                      >
                        Open listing
                      </a>
                    )}
                    <button
                      onClick={() => setEditingId(p.id)}
                      className="flex-1 text-center border border-amber-700 text-amber-200 rounded px-2 py-1 text-xs hover:bg-amber-950/40"
                    >
                      Move pin
                    </button>
                    <Link
                      href={`/properties/${p.id}`}
                      className="flex-1 text-center border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-xs"
                    >
                      Details
                    </Link>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
