"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";
import { OverlayColorSwatch } from "./OverlayColorSwatch";
import {
  fetchMinutesToMontrose,
  getCachedMinutes,
  getCommuteDest,
  saveCommuteDest,
  geocodeAddress,
  type Destination,
} from "@/lib/travel-time";
import { hasInUnitLaundry } from "@/lib/property-helpers";

const STATUS_COLOR: Record<TourStatus, string> = {
  not_toured: "#71717a",
  called: "#fb923c",
  scheduled: "#60a5fa",
  toured: "#4ade80",
  rejected: "#f87171",
  top_pick: "#facc15",
};
const STATUS_LABEL: Record<TourStatus, string> = {
  not_toured: "Not toured",
  called: "Called",
  scheduled: "Scheduled",
  toured: "Toured",
  rejected: "Rejected",
  top_pick: "Top pick",
};
const STATUS_RANK: Record<TourStatus, number> = {
  top_pick: 0,
  scheduled: 1,
  called: 2,
  toured: 3,
  not_toured: 4,
  rejected: 5,
};
const STATUS_CYCLE: TourStatus[] = [
  "not_toured",
  "called",
  "scheduled",
  "toured",
  "top_pick",
  "rejected",
];

export type SortKey =
  | "default"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "date"
  | "my_ranking"
  | "commute_asc";

interface SidebarProps {
  properties: Property[];
  onSelect: (p: Property) => void;
  onChanged?: () => void;
  filter: Set<TourStatus>;
  setFilter: (s: Set<TourStatus>) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  pickingForId?: string | null;
  onStartPick?: (id: string | null) => void;
  onClearOverride?: (id: string) => void;
  selectedId?: string | null;
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
  pickingForId,
  onStartPick,
  onClearOverride,
  selectedId,
}: SidebarProps) {
  const router = useRouter();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [reorderDragId, setReorderDragId] = useState<string | null>(null);
  const [reorderDropId, setReorderDropId] = useState<string | null>(null);
  const reorderDragIdRef = useRef<string | null>(null);
  const [commuteDest, setCommuteDest] = useState<Destination>(getCommuteDest);
  const [editingDest, setEditingDest] = useState(false);
  const [destQuery, setDestQuery] = useState("");
  const [destSearching, setDestSearching] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [montroseMins, setMontroseMins] = useState<
    Record<string, number | null>
  >({});
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current[selectedId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    const seeded: Record<string, number | null> = {};
    for (const p of properties) {
      const cached = getCachedMinutes(p.latitude, p.longitude, commuteDest);
      if (cached !== undefined) seeded[p.id] = cached;
    }
    setMontroseMins(seeded);

    (async () => {
      for (const p of properties) {
        if (cancelled) return;
        const cached = getCachedMinutes(p.latitude, p.longitude, commuteDest);
        if (cached !== undefined) continue;
        const m = await fetchMinutesToMontrose(p.latitude, p.longitude, commuteDest);
        if (cancelled) return;
        setMontroseMins((prev) => ({ ...prev, [p.id]: m }));
        await new Promise((r) => setTimeout(r, 250));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [properties, commuteDest]);

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
      case "commute_asc": {
        const am = montroseMins[a.id] ?? Infinity;
        const bm = montroseMins[b.id] ?? Infinity;
        return am - bm;
      }
      case "my_ranking": {
        if (a.rank == null && b.rank == null) return 0;
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      }
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
        const msg = await res.text().catch(() => "");
        window.alert(`Favorite update failed: ${res.status} ${msg}`);
        return;
      }
      onChanged?.();
    } catch (err) {
      setFavOverride((prev) => ({ ...prev, [propertyId]: current }));
      window.alert(
        `Favorite update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handlePasteImage = async (propertyId: string) => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      window.alert(
        "Clipboard image reading isn't supported in this browser. Try dragging the image onto the row instead.",
      );
      return;
    }
    setUploadingId(propertyId);
    try {
      const items = await navigator.clipboard.read();
      let blob: Blob | null = null;
      let textFallback: string | null = null;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          blob = await item.getType(imageType);
          break;
        }
        if (item.types.includes("text/plain")) {
          const t = await (await item.getType("text/plain")).text();
          if (/^https?:\/\//i.test(t.trim())) textFallback = t.trim();
        }
      }

      let res: Response;
      if (blob) {
        const file = new File([blob], "pasted.png", {
          type: blob.type || "image/png",
        });
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch(`/api/properties/${propertyId}/photo`, {
          method: "POST",
          body: fd,
        });
      } else if (textFallback) {
        res = await fetch(`/api/properties/${propertyId}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_url: textFallback }),
        });
      } else {
        window.alert(
          "No image found on the clipboard. Copy an image (or image URL) and try again.",
        );
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        window.alert(`Photo replace failed: ${res.status} ${msg}`);
        return;
      }
      onChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/permission|denied|notallowed/i.test(msg)) {
        window.alert(
          "Clipboard read was blocked. Allow clipboard access for this site, then try again.",
        );
      } else {
        window.alert(`Paste failed: ${msg}`);
      }
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

  const cycleStatus = async (propertyId: string, current: TourStatus) => {
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_status: next }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      window.alert(`Status update failed: ${res.status} ${msg}`);
      return;
    }
    onChanged?.();
  };

  const handleDestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = destQuery.trim();
    if (!q) return;
    setDestSearching(true);
    try {
      const result = await geocodeAddress(q);
      if (!result) {
        window.alert("Address not found. Try a more specific search.");
        return;
      }
      saveCommuteDest(result);
      setCommuteDest(result);
      setMontroseMins({});
      setEditingDest(false);
    } finally {
      setDestSearching(false);
    }
  };

  const handleReorderDrop = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = sorted.map((p) => p.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...ids];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedId);
    const responses = await Promise.all(
      newOrder.map((id, idx) =>
        fetch(`/api/properties/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rank: idx + 1 }),
        }),
      ),
    );
    const failed = responses.find((r) => !r.ok);
    if (failed) {
      const msg = await failed.text().catch(() => "");
      window.alert(
        `Reorder failed: ${failed.status} ${msg}\n\nThis usually means the 'rank' column hasn't been added to the database yet. Run: npx supabase db push`,
      );
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
        <div className="flex items-center gap-1 text-xs">
          <span className="text-zinc-500 shrink-0">Commute to:</span>
          {editingDest ? (
            <form onSubmit={handleDestSubmit} className="flex gap-1 flex-1 min-w-0">
              <input
                autoFocus
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                placeholder="Search address..."
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-zinc-100 text-xs"
              />
              <button
                type="submit"
                disabled={destSearching}
                className="text-zinc-400 hover:text-zinc-100 disabled:opacity-40 shrink-0"
              >
                {destSearching ? "..." : "Set"}
              </button>
              <button
                type="button"
                onClick={() => setEditingDest(false)}
                className="text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setDestQuery(commuteDest.label);
                setEditingDest(true);
              }}
              className="flex items-center gap-1 text-zinc-300 hover:text-zinc-100"
            >
              {commuteDest.label}
              <span className="text-zinc-600 text-[10px]">✎</span>
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100"
        >
          <option value="default">Sort: status, then rating</option>
          <option value="my_ranking">My ranking</option>
          <option value="price_asc">Price ascending</option>
          <option value="price_desc">Price descending</option>
          <option value="rating">Rating</option>
          <option value="commute_asc">Commute (shortest first)</option>
          <option value="date">Date added</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p, idx) => {
          const isDragOver = dragOverId === p.id;
          const isUploading = uploadingId === p.id;
          const isReorderTarget = reorderDropId === p.id && reorderDragId !== p.id;
          const isBeingDragged = reorderDragId === p.id;
          const isSelected = selectedId === p.id;
          return (
            <div
              key={p.id}
              ref={(el) => {
                rowRefs.current[p.id] = el;
              }}
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
                if (reorderDragIdRef.current) {
                  setReorderDropId(p.id);
                } else {
                  setDragOverId(p.id);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (reorderDragIdRef.current) {
                  e.dataTransfer.dropEffect = "move";
                } else {
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverId(null);
                  setReorderDropId(null);
                }
              }}
              onDrop={(e) => {
                if (reorderDragIdRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = reorderDragIdRef.current;
                  reorderDragIdRef.current = null;
                  setReorderDropId(null);
                  setReorderDragId(null);
                  void handleReorderDrop(draggedId, p.id);
                } else {
                  void handleDrop(e, p.id);
                }
              }}
              className={`flex gap-3 p-3 border-b border-zinc-800 cursor-pointer transition-colors ${
                isReorderTarget
                  ? "border-t-2 border-t-sky-500"
                  : ""
              } ${
                isBeingDragged
                  ? "opacity-40"
                  : isDragOver && !reorderDragId
                  ? "bg-emerald-900/40 ring-2 ring-emerald-400 ring-inset"
                  : isSelected
                  ? "bg-sky-950/30 ring-2 ring-sky-400 ring-inset"
                  : "hover:bg-zinc-900"
              }`}
            >
              {sort === "my_ranking" && (
                <div
                  className="flex flex-col items-center justify-center w-5 shrink-0 gap-1 cursor-grab active:cursor-grabbing select-none"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    reorderDragIdRef.current = p.id;
                    setReorderDragId(p.id);
                    e.dataTransfer.setData("text/plain", p.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    reorderDragIdRef.current = null;
                    setReorderDragId(null);
                    setReorderDropId(null);
                  }}
                >
                  <span className="text-[11px] font-mono font-semibold text-zinc-300 leading-none">
                    {idx + 1}
                  </span>
                  <div className="grid grid-cols-2 gap-[2px]">
                    {[...Array(6)].map((_, i) => (
                      <span
                        key={i}
                        className="w-[3px] h-[3px] rounded-full bg-zinc-600"
                      />
                    ))}
                  </div>
                </div>
              )}
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
                {p.property_type === "apartment" && (
                  <span
                    className="absolute top-0 left-0 px-1 py-[1px] rounded-tl rounded-br text-[9px] font-semibold tracking-wider uppercase bg-amber-400 text-zinc-900 shadow pointer-events-none"
                    title="Apartment"
                  >
                    Apt
                  </span>
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
                  {p.square_feet != null &&
                    ` · ${p.square_feet.toLocaleString()} sqft`}
                  {hasInUnitLaundry(p.pros) && (
                    <span
                      className="ml-1.5 font-semibold text-sky-400"
                      title="In-unit washer/dryer"
                    >
                      W/D
                    </span>
                  )}
                </div>
                {montroseMins[p.id] != null && (
                  <div className="text-xs text-zinc-500">
                    {montroseMins[p.id]} min to {commuteDest.label}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void cycleStatus(p.id, p.tour_status);
                    }}
                    title={`${STATUS_LABEL[p.tour_status]} (click to cycle)`}
                    className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-700 hover:ring-zinc-300 transition"
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
                  <OverlayColorSwatch
                    lat={p.latitude}
                    lng={p.longitude}
                    size={16}
                    propertyId={p.id}
                    active={pickingForId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pickingForId === p.id) onStartPick?.(null);
                      else onStartPick?.(p.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClearOverride?.(p.id);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end self-start">
                {(() => {
                  const isFav = favOverride[p.id] ?? p.is_favorite;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(p.id, isFav);
                      }}
                      className={`leading-none transition ${
                        isFav
                          ? "text-rose-500 hover:text-rose-400"
                          : "text-zinc-600 hover:text-rose-400"
                      }`}
                      aria-label={isFav ? "Unfavorite" : "Favorite"}
                      title={isFav ? "Unfavorite" : "Favorite"}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={isFav ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={isFav ? 0 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  );
                })()}
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
            className="w-full text-left px-3 py-2 hover:bg-zinc-800"
            onClick={() => {
              const id = menu.propertyId;
              setMenu(null);
              void handlePasteImage(id);
            }}
          >
            Paste image
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
