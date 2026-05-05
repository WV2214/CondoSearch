"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  hasInUnitLaundry,
  formatAvailability,
  isAvailabilityPast,
  groupByComplexInOrder,
} from "@/lib/property-helpers";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_RANK,
  STATUS_CYCLE,
} from "@/lib/status-display";

export type SortKey =
  | "default"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "date"
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
  onEditRequest?: (id: string) => void;
}

const COLLAPSED_PEEK_PX = 128;

export function Sidebar(props: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const startedExpanded = useRef(false);
  const wasTouched = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    wasTouched.current = true;
    touchStartY.current = e.touches[0].clientY;
    startedExpanded.current = expanded;
    setDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    let dy = e.touches[0].clientY - touchStartY.current;
    const maxCollapse = window.innerHeight * 0.8 - COLLAPSED_PEEK_PX;
    if (startedExpanded.current) {
      dy = Math.max(0, Math.min(maxCollapse, dy));
    } else {
      dy = Math.max(-maxCollapse, Math.min(0, dy));
    }
    setDragOffset(dy);
  };

  const handleTouchEnd = () => {
    if (touchStartY.current == null) return;
    const dy = dragOffset;
    const wasExpanded = startedExpanded.current;
    setDragging(false);
    setDragOffset(0);
    touchStartY.current = null;

    if (Math.abs(dy) < 8) {
      setExpanded((v) => !v);
      return;
    }
    const threshold = window.innerHeight * 0.1;
    if (wasExpanded) {
      setExpanded(dy < threshold);
    } else {
      setExpanded(dy < -threshold);
    }
  };

  const handleClick = () => {
    if (wasTouched.current) {
      wasTouched.current = false;
      return;
    }
    setExpanded((v) => !v);
  };

  let transform: string;
  if (dragging) {
    const startTranslate = startedExpanded.current
      ? "0px"
      : `calc(80vh - ${COLLAPSED_PEEK_PX}px)`;
    transform = `translateY(calc(${startTranslate} + ${dragOffset}px))`;
  } else {
    transform = expanded
      ? "translateY(0)"
      : `translateY(calc(80vh - ${COLLAPSED_PEEK_PX}px))`;
  }

  return (
    <>
      <aside className="hidden md:flex bg-zinc-950 border-l border-zinc-800 text-zinc-100 flex-col h-full w-80">
        <SidebarBody {...props} />
      </aside>

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 text-zinc-100 shadow-2xl rounded-t-xl h-[80vh] z-[1500] ${
          dragging ? "" : "transition-transform duration-300"
        }`}
        style={{ transform, willChange: "transform" }}
      >
        <div
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          role="button"
          aria-label="Toggle property list"
          className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
        >
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="h-[calc(100%-40px)] flex flex-col">
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
  onEditRequest,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [commuteDest, setCommuteDest] = useState<Destination>(getCommuteDest);
  const [editingDest, setEditingDest] = useState(false);
  const [destQuery, setDestQuery] = useState("");
  const [destSearching, setDestSearching] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [montroseMins, setMontroseMins] = useState<
    Record<string, number | null>
  >({});
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});
  const [dislikeOverride, setDislikeOverride] = useState<
    Record<string, boolean>
  >({});
  const [dislikeReasonOverride, setDislikeReasonOverride] = useState<
    Record<string, string>
  >({});
  const [editingReasonFor, setEditingReasonFor] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
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

  const q = query.trim().toLowerCase();
  const filtered = properties.filter((p) => {
    if (filter.size > 0 && !filter.has(p.tour_status)) return false;
    if (q.length > 0) {
      const haystack = `${p.address} ${p.complex_name}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const tier = (p: Property) => {
    const fav = favOverride[p.id] ?? p.is_favorite;
    const down = dislikeOverride[p.id] ?? p.is_disliked;
    if (fav) return 0;
    if (down) return 2;
    return 1;
  };
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
      default: {
        const td = tier(a) - tier(b);
        if (td !== 0) return td;
        return (a.price ?? Infinity) - (b.price ?? Infinity);
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

  const openReasonEditor = (propertyId: string, currentReason: string) => {
    setReasonDraft(currentReason);
    setEditingReasonFor(propertyId);
  };

  const closeReasonEditor = () => {
    setEditingReasonFor(null);
    setReasonDraft("");
  };

  const saveDislikeReason = async (
    propertyId: string,
    previousReason: string,
  ) => {
    const reason = reasonDraft.trim();
    closeReasonEditor();
    if (reason === previousReason) return;
    setDislikeReasonOverride((prev) => ({ ...prev, [propertyId]: reason }));
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dislike_reason: reason }),
      });
      if (!res.ok) {
        setDislikeReasonOverride((prev) => ({
          ...prev,
          [propertyId]: previousReason,
        }));
        const msg = await res.text().catch(() => "");
        window.alert(`Reason update failed: ${res.status} ${msg}`);
        return;
      }
      onChanged?.();
    } catch (err) {
      setDislikeReasonOverride((prev) => ({
        ...prev,
        [propertyId]: previousReason,
      }));
      window.alert(
        `Reason update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const toggleDislike = async (
    propertyId: string,
    current: boolean,
    currentReason: string,
  ) => {
    const next = !current;
    setDislikeOverride((prev) => ({ ...prev, [propertyId]: next }));
    if (next) {
      openReasonEditor(propertyId, currentReason);
    } else {
      if (editingReasonFor === propertyId) closeReasonEditor();
      setDislikeReasonOverride((prev) => ({ ...prev, [propertyId]: "" }));
    }
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_disliked: next,
          ...(next ? {} : { dislike_reason: "" }),
        }),
      });
      if (!res.ok) {
        setDislikeOverride((prev) => ({ ...prev, [propertyId]: current }));
        const msg = await res.text().catch(() => "");
        window.alert(`Downvote update failed: ${res.status} ${msg}`);
        return;
      }
      onChanged?.();
    } catch (err) {
      setDislikeOverride((prev) => ({ ...prev, [propertyId]: current }));
      window.alert(
        `Downvote update failed: ${err instanceof Error ? err.message : String(err)}`,
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

  return (
    <>
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address or complex name…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded pl-7 pr-7 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 px-1 leading-none"
              aria-label="Clear search"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-sm font-semibold">
          {filtered.length} properties
          {q.length > 0 && (
            <span className="ml-1 text-xs font-normal text-zinc-500">
              matching “{query.trim()}”
            </span>
          )}
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
          <option value="default">Sort: favorites, cost, downvotes</option>
          <option value="price_asc">Price ascending</option>
          <option value="price_desc">Price descending</option>
          <option value="rating">Rating</option>
          <option value="commute_asc">Commute (shortest first)</option>
          <option value="date">Date added</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groupByComplexInOrder(sorted).flatMap((group) => {
          const expanded = expandedGroups.has(group.key);
          const showSiblings = expanded && group.siblings.length > 0;
          const visible = showSiblings
            ? [group.primary, ...group.siblings]
            : [group.primary];
          return visible.map((p, idx) => {
            const isPrimary = idx === 0;
            const isNested = !isPrimary;
            const siblingCount = group.siblings.length;
          const isDragOver = dragOverId === p.id;
          const isUploading = uploadingId === p.id;
          const isSelected = selectedId === p.id;
          const isDownvoted = dislikeOverride[p.id] ?? p.is_disliked;
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
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverId(null);
                }
              }}
              onDrop={(e) => {
                void handleDrop(e, p.id);
              }}
              className={`flex gap-3 p-3 border-b border-zinc-800 cursor-pointer transition-colors ${
                isNested ? "pl-7 bg-zinc-900/40 border-l-2 border-l-zinc-700" : ""
              } ${
                isDragOver
                  ? "bg-emerald-900/40 ring-2 ring-emerald-400 ring-inset"
                  : isSelected
                  ? "bg-sky-950/30 ring-2 ring-sky-400 ring-inset"
                  : isDownvoted
                  ? "opacity-60 hover:opacity-100 hover:bg-zinc-900"
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
                {isPrimary && p.complex_name && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="text-[10px] font-semibold text-zinc-400 truncate leading-tight tracking-wide uppercase">
                      {p.complex_name}
                    </div>
                    {siblingCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(group.key);
                        }}
                        className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-wide uppercase text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700 rounded px-1.5 py-[1px] leading-none transition"
                        title={
                          expanded
                            ? `Hide ${siblingCount} other unit${siblingCount === 1 ? "" : "s"}`
                            : `Show ${siblingCount} more unit${siblingCount === 1 ? "" : "s"}`
                        }
                      >
                        <span>{expanded ? "−" : "+"}{siblingCount}</span>
                      </button>
                    )}
                  </div>
                )}
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
                {p.availability_date && (
                  <div
                    className={`text-xs ${
                      isAvailabilityPast(p.availability_date)
                        ? "text-emerald-400"
                        : "text-zinc-500"
                    }`}
                  >
                    Available {formatAvailability(p.availability_date)}
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
                  {!isNested && (
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
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 items-end self-start">
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
                {(() => {
                  const isFav = favOverride[p.id] ?? p.is_favorite;
                  const isDown = dislikeOverride[p.id] ?? p.is_disliked;
                  const downReason =
                    dislikeReasonOverride[p.id] ?? p.dislike_reason ?? "";
                  const downTitle = isDown
                    ? downReason
                      ? `Reason: ${downReason} (click to remove)`
                      : "Remove downvote"
                    : "Downvote";
                  return (
                    <>
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
                      <div className="relative">
                        {editingReasonFor === p.id && (
                          <input
                            autoFocus
                            value={reasonDraft}
                            onChange={(e) => setReasonDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                void saveDislikeReason(p.id, downReason);
                              } else if (e.key === "Escape") {
                                closeReasonEditor();
                              }
                            }}
                            onBlur={() =>
                              void saveDislikeReason(p.id, downReason)
                            }
                            placeholder="Reason…"
                            className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 w-44 bg-zinc-900 border border-orange-400 rounded text-xs px-2 py-1 text-zinc-100 placeholder-zinc-500 focus:outline-none shadow-lg z-30"
                          />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleDislike(p.id, isDown, downReason);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isDown) openReasonEditor(p.id, downReason);
                          }}
                          className={`leading-none transition ${
                            isDown
                              ? "text-orange-400 hover:text-orange-300"
                              : "text-zinc-600 hover:text-orange-400"
                          }`}
                          aria-label={downTitle}
                          title={downTitle}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={isDown ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={isDown ? 0 : 2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                          </svg>
                        </button>
                      </div>
                    </>
                  );
                })()}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRequest?.(p.id);
                  }}
                  className="text-[10px] font-semibold tracking-wider text-zinc-300 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded px-1.5 py-0.5 leading-none transition"
                  title="Edit details"
                >
                  EDIT
                </button>
              </div>
            </div>
          );
          });
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
              onEditRequest?.(id);
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
