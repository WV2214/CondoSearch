"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";
import { OverlayColorSwatch } from "./OverlayColorSwatch";

const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#71717a",
  scheduled: "#60a5fa",
  toured: "#4ade80",
  rejected: "#f87171",
  top_pick: "#facc15",
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
  onChanged?: () => void;
  filter: Set<TourStatus>;
  setFilter: (s: Set<TourStatus>) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
}

export function Sidebar(props: SidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <aside className="hidden md:flex bg-zinc-950 border-l border-zinc-800 text-zinc-100 flex-col h-full w-80">
        <SidebarBody {...props} />
      </aside>

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 text-zinc-100 shadow-2xl rounded-t-xl transition-[height] duration-300 z-[1500] ${
          expanded ? "h-[80vh]" : "h-32"
        }`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 flex justify-center"
          aria-label="Toggle property list"
        >
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </button>
        <div className="h-[calc(100%-32px)] flex flex-col">
          <SidebarBody {...props} />
        </div>
      </div>
    </>
  );
}

function extractUrlFromDataTransfer(dt: DataTransfer): string | null {
  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    const first = uriList
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && !s.startsWith("#"));
    if (first) return first;
  }
  const html = dt.getData("text/html");
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }
  const text = dt.getData("text/plain");
  if (text && /^https?:\/\//i.test(text.trim())) return text.trim();
  return null;
}

type ContextMenuState = {
  propertyId: string;
  address: string;
  x: number;
  y: number;
};

function SidebarBody({
  properties,
  onSelect,
  onChanged,
  filter,
  setFilter,
  sort,
  setSort,
}: SidebarProps) {
  const router = useRouter();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

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

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    propertyId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);

    const dt = e.dataTransfer;
    const file = dt.files && dt.files[0];

    setUploadingId(propertyId);
    try {
      let res: Response;
      if (file && file.type.startsWith("image/")) {
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch(`/api/properties/${propertyId}/photo`, {
          method: "POST",
          body: fd,
        });
      } else {
        const url = extractUrlFromDataTransfer(dt);
        if (!url) {
          window.alert(
            "No image or image URL found in drop. Try dragging the image directly.",
          );
          return;
        }
        res = await fetch(`/api/properties/${propertyId}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_url: url }),
        });
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        window.alert(`Photo upload failed: ${res.status} ${msg}`);
        return;
      }
      onChanged?.();
    } catch (err) {
      window.alert(
        `Photo upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setUploadingId(null);
    }
  };

  const handleDelete = async (propertyId: string, address: string) => {
    if (!window.confirm(`Delete "${address}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      window.alert(`Delete failed: ${res.status} ${msg}`);
      return;
    }
    onChanged?.();
  };

  return (
    <>
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="text-sm font-semibold">
          {filtered.length} properties
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(STATUS_LABEL) as TourStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`text-xs px-2 py-1 rounded border transition ${
                filter.has(s)
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100"
        >
          <option value="default">Sort: status, then rating</option>
          <option value="price_asc">Price ascending</option>
          <option value="price_desc">Price descending</option>
          <option value="rating">Rating</option>
          <option value="date">Date added</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => {
          const isDragOver = dragOverId === p.id;
          const isUploading = uploadingId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({
                  propertyId: p.id,
                  address: p.address,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId(p.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget === e.target) setDragOverId(null);
              }}
              onDrop={(e) => handleDrop(e, p.id)}
              className={`flex gap-3 p-3 border-b border-zinc-800 cursor-pointer transition-colors ${
                isDragOver
                  ? "bg-emerald-900/40 ring-2 ring-emerald-400 ring-inset"
                  : "hover:bg-zinc-900"
              }`}
            >
              <div className="relative w-16 h-16 shrink-0">
                {p.photo_path ? (
                  <img
                    src={`${publicPhotoUrl(p.photo_path)}?t=${encodeURIComponent(p.updated_at)}`}
                    alt=""
                    className="w-16 h-16 object-cover rounded pointer-events-none"
                  />
                ) : (
                  <div
                    className={`w-16 h-16 rounded ${
                      isDragOver
                        ? "bg-emerald-800/60 border-2 border-dashed border-emerald-400"
                        : "bg-zinc-800 border-2 border-dashed border-zinc-700"
                    }`}
                  />
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded text-[10px] text-zinc-100">
                    Uploading…
                  </div>
                )}
                {isDragOver && !isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 rounded text-[10px] text-emerald-100 font-semibold pointer-events-none">
                    Drop
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-zinc-100">
                  {p.address}
                </div>
                <div className="text-xs text-zinc-400">
                  {p.price ? `$${p.price.toLocaleString()}` : "—"}
                  {p.beds != null && ` · ${p.beds}bd`}
                  {p.baths != null && ` ${p.baths}ba`}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLOR[p.tour_status] }}
                  />
                  <span className="text-xs text-zinc-400">
                    {STATUS_LABEL[p.tour_status]}
                  </span>
                  {p.star_rating && (
                    <span className="text-xs text-amber-300">
                      {"★".repeat(p.star_rating)}
                    </span>
                  )}
                  <OverlayColorSwatch lat={p.latitude} lng={p.longitude} size={8} />
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end self-start">
                <Link
                  href={`/properties/${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-zinc-500 hover:text-zinc-200 leading-none"
                  title="Open details"
                >
                  →
                </Link>
                {p.listing_urls[0] && (
                  <a
                    href={p.listing_urls[0]}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-zinc-500 hover:text-zinc-300 leading-none"
                    title="Open listing"
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No properties match the current filter.
          </div>
        )}
      </div>
      {menu && (
        <div
          className="fixed z-[2000] min-w-[140px] bg-zinc-900 border border-zinc-700 rounded shadow-xl text-sm text-zinc-100 overflow-hidden"
          style={{
            left: Math.min(menu.x, window.innerWidth - 160),
            top: Math.min(menu.y, window.innerHeight - 90),
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="w-full text-left px-3 py-2 hover:bg-zinc-800"
            onClick={() => {
              const id = menu.propertyId;
              setMenu(null);
              router.push(`/properties/${id}`);
            }}
          >
            Edit
          </button>
          <button
            className="w-full text-left px-3 py-2 text-red-400 hover:bg-zinc-800"
            onClick={() => {
              const id = menu.propertyId;
              const address = menu.address;
              setMenu(null);
              void handleDelete(id, address);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
