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
import { hasInUnitLaundry } from "@/lib/property-helpers";

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
  onPinClick,
}: {
  properties: Property[];
  onMoved: () => void;
  onPinClick?: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, [number, number]>
  >({});
  const [crimeColors, setCrimeColors] = useState<Record<string, string>>({});
  const [overrideTick, setOverrideTick] = useState(0);
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});

  const toggleFavorite = async (propertyId: string, current: boolean) => {
    const next = !current;
    setFavOverride((prev) => ({ ...prev, [propertyId]: next }));
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
      if (!res.ok) {
        setFavOverride((prev) => ({ ...prev, [propertyId]: current }));
        return;
      }
      onMoved();
    } catch {
      setFavOverride((prev) => ({ ...prev, [propertyId]: current }));
    }
  };

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
              click: () => {
                onPinClick?.(p.id);
              },
            }}
          >
            <Popup>
              <PopupBody
                p={p}
                lat={lat}
                lng={lng}
                isEditing={isEditing}
                isFavorite={favOverride[p.id] ?? p.is_favorite}
                onToggleFavorite={() =>
                  toggleFavorite(
                    p.id,
                    favOverride[p.id] ?? p.is_favorite,
                  )
                }
                onStartEdit={() => setEditingId(p.id)}
                onCancelEdit={() => cancelEdit(p.id)}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function PopupBody({
  p,
  lat,
  lng,
  isEditing,
  isFavorite,
  onToggleFavorite,
  onStartEdit,
  onCancelEdit,
}: {
  p: Property;
  lat: number;
  lng: number;
  isEditing: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isApartment = p.property_type === "apartment";
  const wd = hasInUnitLaundry(p.pros);
  return (
    <div className="space-y-2.5 w-64 text-zinc-100">
      {p.photo_path && (
        <div className="relative">
          <img
            src={publicPhotoUrl(p.photo_path)}
            alt={p.address}
            className="w-full h-32 object-cover rounded"
          />
          {isApartment && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-[2px] rounded text-[10px] font-semibold tracking-wider uppercase bg-amber-400 text-zinc-900 shadow">
              Apt
            </span>
          )}
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`absolute top-1.5 right-1.5 rounded-full p-1 transition ${
              isFavorite
                ? "bg-zinc-900/60 text-rose-500 hover:text-rose-400"
                : "bg-zinc-900/60 text-zinc-300 hover:text-rose-400"
            }`}
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
            title={isFavorite ? "Unfavorite" : "Favorite"}
          >
            <HeartIcon filled={isFavorite} />
          </button>
        </div>
      )}
      <div className="flex items-start gap-2">
        <span className="font-semibold leading-tight">{p.address}</span>
        <OverlayColorSwatch
          lat={lat}
          lng={lng}
          size={10}
          propertyId={p.id}
        />
        {!p.photo_path && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`ml-auto shrink-0 leading-none transition ${
              isFavorite
                ? "text-rose-500 hover:text-rose-400"
                : "text-zinc-500 hover:text-rose-400"
            }`}
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
            title={isFavorite ? "Unfavorite" : "Favorite"}
          >
            <HeartIcon filled={isFavorite} />
          </button>
        )}
      </div>
      <div className="text-sm text-zinc-300">
        {p.price ? `$${p.price.toLocaleString()}/mo` : "Price unknown"}
        {p.beds != null && ` · ${p.beds}bd`}
        {p.baths != null && ` ${p.baths}ba`}
        {p.square_feet != null &&
          ` · ${p.square_feet.toLocaleString()} sqft`}
        {wd && (
          <span
            className="ml-1.5 font-semibold text-sky-400"
            title="In-unit washer/dryer"
          >
            W/D
          </span>
        )}
        {!p.photo_path && isApartment && (
          <span className="ml-1.5 px-1.5 py-[1px] rounded text-[10px] font-semibold tracking-wider uppercase bg-amber-400 text-zinc-900 align-middle">
            Apt
          </span>
        )}
      </div>
      {p.star_rating && (
        <div className="text-sm text-amber-300">
          {"★".repeat(p.star_rating)}
        </div>
      )}
      {isEditing ? (
        <div className="space-y-2 pt-1">
          <div className="text-xs text-amber-300">
            Drag the pin to move it. Drop to save.
          </div>
          <button
            onClick={onCancelEdit}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {p.listing_urls[0] ? (
            <a
              href={p.listing_urls[0]}
              target="_blank"
              rel="noreferrer"
              className="text-center bg-zinc-100 text-zinc-900 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-white transition"
            >
              Listing
            </a>
          ) : (
            <span className="text-center bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-md px-2 py-1.5 text-xs font-medium cursor-not-allowed">
              Listing
            </span>
          )}
          <Link
            href={`/properties/${p.id}`}
            className="text-center bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
          >
            Details
          </Link>
          <button
            type="button"
            onClick={onStartEdit}
            className="text-center bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
          >
            Move
          </button>
        </div>
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
