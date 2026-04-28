"use client";

import { CircleMarker, Popup } from "react-leaflet";
import Link from "next/link";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";

const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#71717a",
  scheduled: "#60a5fa",
  toured: "#4ade80",
  rejected: "#f87171",
  top_pick: "#facc15",
};

export function PropertyPins({ properties }: { properties: Property[] }) {
  return (
    <>
      {properties.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={9}
          pathOptions={{
            color: "#0a0a0a",
            weight: 2,
            fillColor: STATUS_COLOR[p.tour_status],
            fillOpacity: 1,
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
              <div className="font-semibold">{p.address}</div>
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
              <div className="flex gap-2 pt-2">
                <a
                  href={p.listing_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center bg-zinc-100 text-zinc-900 rounded px-2 py-1 text-xs font-medium"
                >
                  Open listing
                </a>
                <Link
                  href={`/properties/${p.id}`}
                  className="flex-1 text-center border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-xs"
                >
                  Details
                </Link>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
