"use client";

import { useState } from "react";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";

const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#6b7280",
  scheduled: "#2563eb",
  toured: "#16a34a",
  rejected: "#dc2626",
  top_pick: "#eab308",
};
const STATUS_LABEL: Record<TourStatus, string> = {
  not_toured: "Not toured",
  scheduled: "Scheduled",
  toured: "Toured",
  rejected: "Rejected",
  top_pick: "Top pick",
};
const STATUS_RANK: Record<TourStatus, number> = {
  top_pick: 0,
  scheduled: 1,
  toured: 2,
  not_toured: 3,
  rejected: 4,
};

export type SortKey =
  | "default"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "date";

interface SidebarProps {
  properties: Property[];
  onSelect: (p: Property) => void;
  filter: Set<TourStatus>;
  setFilter: (s: Set<TourStatus>) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
}

export function Sidebar(props: SidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <aside className="hidden md:flex bg-white border-l flex-col h-full w-80">
        <SidebarBody {...props} />
      </aside>

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl rounded-t-xl transition-[height] duration-300 z-[1500] ${
          expanded ? "h-[80vh]" : "h-32"
        }`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 flex justify-center"
          aria-label="Toggle property list"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </button>
        <div className="h-[calc(100%-32px)] flex flex-col">
          <SidebarBody {...props} />
        </div>
      </div>
    </>
  );
}

function SidebarBody({
  properties,
  onSelect,
  filter,
  setFilter,
  sort,
  setSort,
}: SidebarProps) {
  const filtered = properties.filter((p) =>
    filter.size === 0 ? true : filter.has(p.tour_status),
  );
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "price_desc":
        return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      case "rating":
        return (b.star_rating ?? 0) - (a.star_rating ?? 0);
      case "date":
        return b.created_at.localeCompare(a.created_at);
      default: {
        const sd = STATUS_RANK[a.tour_status] - STATUS_RANK[b.tour_status];
        if (sd !== 0) return sd;
        return (b.star_rating ?? 0) - (a.star_rating ?? 0);
      }
    }
  });

  const toggleStatus = (s: TourStatus) => {
    const next = new Set(filter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setFilter(next);
  };

  return (
    <>
      <div className="p-3 border-b space-y-2">
        <div className="text-sm font-semibold">{filtered.length} properties</div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(STATUS_LABEL) as TourStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`text-xs px-2 py-1 rounded border ${
                filter.has(s)
                  ? "bg-black text-white border-black"
                  : "bg-white"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-full border rounded px-2 py-1 text-sm"
        >
          <option value="default">Sort: status, then rating</option>
          <option value="price_asc">Price ascending</option>
          <option value="price_desc">Price descending</option>
          <option value="rating">Rating</option>
          <option value="date">Date added</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex gap-3 p-3 border-b cursor-pointer hover:bg-gray-50"
          >
            {p.photo_path ? (
              <img
                src={publicPhotoUrl(p.photo_path)}
                alt=""
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.address}</div>
              <div className="text-xs text-gray-600">
                {p.price ? `$${p.price.toLocaleString()}` : "—"}
                {p.beds != null && ` · ${p.beds}bd`}
                {p.baths != null && ` ${p.baths}ba`}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: STATUS_COLOR[p.tour_status] }}
                />
                <span className="text-xs text-gray-600">
                  {STATUS_LABEL[p.tour_status]}
                </span>
                {p.star_rating && (
                  <span className="text-xs">
                    {"★".repeat(p.star_rating)}
                  </span>
                )}
              </div>
            </div>
            <a
              href={p.listing_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-500 self-start"
            >
              ↗
            </a>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="p-6 text-sm text-gray-500 text-center">
            No properties match the current filter.
          </div>
        )}
      </div>
    </>
  );
}
