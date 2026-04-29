"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Property } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";
import { OverlayColorSwatch } from "./OverlayColorSwatch";
import { sampleOverlayColor } from "@/lib/overlay-sample";
import { CRIME_OVERLAY, loadStoredBounds } from "@/lib/overlay-config";
import {
  getOverride,
  subscribeOverrides,
} from "@/lib/overlay-color-overrides";
import { hasInUnitLaundry } from "@/lib/property-helpers";
import { STATUS_COLOR } from "@/lib/status-display";

const NO_CRIME_COLOR = "#3f3f46";

const HEART_PATH =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

function pinIcon(
  crimeColor: string,
  statusColor: string,
  dragging: boolean,
  favorited: boolean,
  disliked: boolean,
) {
  const opacity = disliked ? 0.45 : 1;
  if (favorited) {
    const stroke = dragging ? "#fde047" : "#0a0a0a";
    const sw = dragging ? 2.5 : 1.5;
    const filter = dragging
      ? "drop-shadow(0 0 4px rgba(253,224,71,0.6))"
      : "drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))";
    const id = Math.random().toString(36).slice(2, 8);
    const svg = `<svg viewBox="0 0 24 22" width="22" height="20" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:${filter};opacity:${opacity};overflow:visible;">
      <defs>
        <clipPath id="hl-${id}"><rect x="0" y="0" width="12" height="22"/></clipPath>
        <clipPath id="hr-${id}"><rect x="12" y="0" width="12" height="22"/></clipPath>
      </defs>
      <g transform="translate(0 -1)">
        <path d="${HEART_PATH}" fill="${crimeColor}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" clip-path="url(#hl-${id})"/>
        <path d="${HEART_PATH}" fill="${statusColor}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" clip-path="url(#hr-${id})"/>
      </g>
    </svg>`;
    return L.divIcon({
      className: "",
      html: svg,
      iconSize: [22, 20],
      iconAnchor: [11, 10],
    });
  }
  const border = dragging ? "2px dashed #fde047" : "2px solid #0a0a0a";
  const shadow = dragging
    ? "box-shadow:0 0 0 3px rgba(253,224,71,0.45);"
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;border:${border};${shadow}overflow:hidden;display:flex;opacity:${opacity};"><div style="width:50%;height:100%;background:${crimeColor};"></div><div style="width:50%;height:100%;background:${statusColor};"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function PropertyPins({
  properties,
  onMoved,
  onPinClick,
  onEdit,
}: {
  properties: Property[];
  onMoved: () => void;
  onPinClick?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, [number, number]>
  >({});
  const [crimeColors, setCrimeColors] = useState<Record<string, string>>({});
  const [overrideTick, setOverrideTick] = useState(0);
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});
  const [dislikeOverride, setDislikeOverride] = useState<
    Record<string, boolean>
  >({});

  const toggleFavorite = useCallback(
    async (propertyId: string, current: boolean) => {
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
    },
    [onMoved],
  );

  const toggleDislike = useCallback(
    async (propertyId: string, current: boolean) => {
      const next = !current;
      setDislikeOverride((prev) => ({ ...prev, [propertyId]: next }));
      try {
        const res = await fetch(`/api/properties/${propertyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_disliked: next }),
        });
        if (!res.ok) {
          setDislikeOverride((prev) => ({ ...prev, [propertyId]: current }));
          return;
        }
        onMoved();
      } catch {
        setDislikeOverride((prev) => ({ ...prev, [propertyId]: current }));
      }
    },
    [onMoved],
  );

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
        const isFav = favOverride[p.id] ?? p.is_favorite;
        const isDisliked = dislikeOverride[p.id] ?? p.is_disliked;
        return (
          <Marker
            key={p.id}
            position={[lat, lng]}
            draggable={isEditing}
            icon={pinIcon(
              crimeColors[p.id] ?? NO_CRIME_COLOR,
              STATUS_COLOR[p.tour_status],
              isEditing,
              isFav,
              isDisliked,
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
                isFavorite={isFav}
                isDisliked={isDisliked}
                onToggleFavorite={() => toggleFavorite(p.id, isFav)}
                onToggleDislike={() => toggleDislike(p.id, isDisliked)}
                onStartEdit={() => setEditingId(p.id)}
                onCancelEdit={() => cancelEdit(p.id)}
                onOpenDetails={() => onEdit?.(p.id)}
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
  isDisliked,
  onToggleFavorite,
  onToggleDislike,
  onStartEdit,
  onCancelEdit,
  onOpenDetails,
}: {
  p: Property;
  lat: number;
  lng: number;
  isEditing: boolean;
  isFavorite: boolean;
  isDisliked: boolean;
  onToggleFavorite: () => void;
  onToggleDislike: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onOpenDetails: () => void;
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
            className={`w-full h-32 object-cover rounded ${
              isDisliked ? "opacity-50" : ""
            }`}
          />
          {isApartment && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-[2px] rounded text-[10px] font-semibold tracking-wider uppercase bg-amber-400 text-zinc-900 shadow">
              Apt
            </span>
          )}
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <NativeClickButton
              onClick={onToggleDislike}
              className={`rounded-full p-1 transition bg-zinc-900/70 ${
                isDisliked
                  ? "text-orange-400 hover:text-orange-300"
                  : "text-zinc-300 hover:text-orange-400"
              }`}
              ariaLabel={isDisliked ? "Remove downvote" : "Downvote"}
            >
              <ThumbsDownIcon filled={isDisliked} />
            </NativeClickButton>
            <NativeClickButton
              onClick={onToggleFavorite}
              className={`rounded-full p-1 transition bg-zinc-900/70 ${
                isFavorite
                  ? "text-rose-500 hover:text-rose-400"
                  : "text-zinc-300 hover:text-rose-400"
              }`}
              ariaLabel={isFavorite ? "Unfavorite" : "Favorite"}
            >
              <HeartIcon filled={isFavorite} />
            </NativeClickButton>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2">
        <span
          className={`font-semibold leading-tight ${
            isDisliked ? "line-through text-zinc-400" : ""
          }`}
        >
          {p.address}
        </span>
        <OverlayColorSwatch
          lat={lat}
          lng={lng}
          size={10}
          propertyId={p.id}
        />
        {!p.photo_path && (
          <div className="ml-auto shrink-0 flex gap-1.5">
            <NativeClickButton
              onClick={onToggleDislike}
              className={`leading-none transition ${
                isDisliked
                  ? "text-orange-400 hover:text-orange-300"
                  : "text-zinc-500 hover:text-orange-400"
              }`}
              ariaLabel={isDisliked ? "Remove downvote" : "Downvote"}
            >
              <ThumbsDownIcon filled={isDisliked} />
            </NativeClickButton>
            <NativeClickButton
              onClick={onToggleFavorite}
              className={`leading-none transition ${
                isFavorite
                  ? "text-rose-500 hover:text-rose-400"
                  : "text-zinc-500 hover:text-rose-400"
              }`}
              ariaLabel={isFavorite ? "Unfavorite" : "Favorite"}
            >
              <HeartIcon filled={isFavorite} />
            </NativeClickButton>
          </div>
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
          <NativeClickButton
            onClick={onCancelEdit}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
            ariaLabel="Cancel move"
          >
            Cancel
          </NativeClickButton>
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
          <NativeClickButton
            onClick={onOpenDetails}
            className="text-center bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
            ariaLabel="Edit details"
          >
            Edit
          </NativeClickButton>
          <NativeClickButton
            onClick={onStartEdit}
            className="text-center bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 hover:border-zinc-500 transition"
            ariaLabel="Move pin"
          >
            Move
          </NativeClickButton>
        </div>
      )}
    </div>
  );
}

function NativeClickButton({
  onClick,
  ariaLabel,
  className,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const setRef = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return;
    el.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClickRef.current();
    };
  }, []);
  return (
    <button
      type="button"
      ref={setRef}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={className}
    >
      {children}
    </button>
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

function ThumbsDownIcon({ filled }: { filled: boolean }) {
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
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}
