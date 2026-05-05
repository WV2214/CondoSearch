"use client";

import { useEffect, useRef, useState } from "react";
import type { Property, PropertyType, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";
import { OverlayColorSwatch } from "./OverlayColorSwatch";
import { STATUSES, STATUS_LABEL } from "@/lib/status-display";
import { stripUnitSuffix } from "@/lib/property-helpers";

const inputCls =
  "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm";

const numericInputCls =
  "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm";

interface Props {
  property: Property;
  siblings?: Property[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onSwitchProperty?: (id: string) => void;
  onAddUnit?: () => void;
}

export function PropertyEditModal({
  property,
  siblings = [],
  onClose,
  onChanged,
  onDeleted,
  onSwitchProperty,
  onAddUnit,
}: Props) {
  const [p, setP] = useState<Property>(property);
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setP(property);
  }, [property.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flushChanges = (latest: Property, patchData: Partial<Property>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/properties/${latest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
      if (res.ok) onChanged();
    }, 400);
  };

  const patch = (patchData: Partial<Property>) => {
    setP((prev) => {
      const next = { ...prev, ...patchData };
      flushChanges(next, patchData);
      return next;
    });
  };

  const replacePhoto = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/properties/${p.id}/photo`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const { photo_path } = await res.json();
        setP((prev) => ({ ...prev, photo_path }));
        onChanged();
      }
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!p.photo_path) return;
    if (!confirm("Remove this photo?")) return;
    const res = await fetch(`/api/properties/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_path: null }),
    });
    if (res.ok) {
      setP((prev) => ({ ...prev, photo_path: null }));
      onChanged();
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${p.address}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/properties/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted();
      onClose();
    }
  };

  const numberOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const intOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const setUrlAt = (i: number, value: string) => {
    const next = [...p.listing_urls];
    next[i] = value;
    setP((prev) => ({ ...prev, listing_urls: next }));
  };

  const commitUrls = () => {
    const cleaned = p.listing_urls
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    patch({ listing_urls: cleaned });
  };

  const addUrl = () => {
    setP((prev) => ({ ...prev, listing_urls: [...prev.listing_urls, ""] }));
  };

  const removeUrl = (i: number) => {
    const next = p.listing_urls.filter((_, j) => j !== i);
    patch({ listing_urls: next });
  };

  const setProAt = (i: number, value: string) => {
    const next = [...p.pros];
    next[i] = value;
    patch({ pros: next });
  };
  const addPro = () => patch({ pros: [...p.pros, ""] });
  const removePro = (i: number) =>
    patch({ pros: p.pros.filter((_, j) => j !== i) });

  const setConAt = (i: number, value: string) => {
    const next = [...p.cons];
    next[i] = value;
    patch({ cons: next });
  };
  const addCon = () => patch({ cons: [...p.cons, ""] });
  const removeCon = (i: number) =>
    patch({ cons: p.cons.filter((_, j) => j !== i) });

  return (
    <div
      className="fixed inset-0 z-[2500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-zinc-500 mb-0.5">Edit property</div>
            <div className="text-sm font-semibold text-zinc-100 truncate">
              {p.address || "Unnamed"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => patch({ is_favorite: !p.is_favorite })}
              className={`p-1.5 rounded transition ${
                p.is_favorite
                  ? "text-rose-500 hover:text-rose-400"
                  : "text-zinc-500 hover:text-rose-400"
              }`}
              aria-label={p.is_favorite ? "Unfavorite" : "Favorite"}
              title={p.is_favorite ? "Unfavorite" : "Favorite"}
            >
              <HeartIcon filled={p.is_favorite} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !p.is_disliked;
                patch(
                  next
                    ? { is_disliked: true }
                    : { is_disliked: false, dislike_reason: "" },
                );
              }}
              className={`p-1.5 rounded transition ${
                p.is_disliked
                  ? "text-orange-400 hover:text-orange-300"
                  : "text-zinc-500 hover:text-orange-400"
              }`}
              aria-label={
                p.is_disliked
                  ? p.dislike_reason
                    ? `Reason: ${p.dislike_reason} (click to remove)`
                    : "Remove downvote"
                  : "Downvote"
              }
              title={
                p.is_disliked
                  ? p.dislike_reason
                    ? `Reason: ${p.dislike_reason} (click to remove)`
                    : "Remove downvote"
                  : "Downvote"
              }
            >
              <ThumbsDownIcon filled={p.is_disliked} />
            </button>
            <button
              onClick={remove}
              className="text-xs border border-red-900 text-red-300 rounded px-2 py-1 hover:bg-red-950/40"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1"
              aria-label="Close"
              title="Close (Esc)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          <div>
            {p.photo_path ? (
              <div className="relative">
                <img
                  src={publicPhotoUrl(p.photo_path)}
                  alt={p.address}
                  className="w-full max-h-64 object-cover rounded border border-zinc-800"
                />
                <button
                  onClick={removePhoto}
                  className="absolute top-2 right-2 text-xs bg-zinc-950/80 border border-zinc-700 rounded px-2 py-1 hover:bg-red-950/60 hover:border-red-900 text-zinc-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="w-full h-32 bg-zinc-900 border border-dashed border-zinc-700 rounded flex items-center justify-center text-zinc-500 text-sm">
                No photo
              </div>
            )}
            <label className="inline-block mt-2 text-xs border border-zinc-700 rounded px-3 py-1 cursor-pointer hover:bg-zinc-900 text-zinc-200">
              {uploading ? "Uploading…" : p.photo_path ? "Replace photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) replacePhoto(f);
                }}
              />
            </label>
          </div>

          <section>
            <label className="block mb-2">
              <span className="text-xs text-zinc-400">Complex / building name</span>
              <input
                value={p.complex_name}
                onChange={(e) =>
                  setP((prev) => ({ ...prev, complex_name: e.target.value }))
                }
                onBlur={() => patch({ complex_name: p.complex_name })}
                className={`${inputCls} mt-1`}
                placeholder="e.g. The Monarch, Westbury Flats"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Address</span>
              <input
                value={p.address}
                onChange={(e) =>
                  setP((prev) => ({ ...prev, address: e.target.value }))
                }
                onBlur={() => patch({ address: p.address })}
                className={`${inputCls} mt-1`}
                placeholder="Street, City, State ZIP"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="block">
                <span className="text-xs text-zinc-400">Latitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={p.latitude}
                  onChange={(e) => {
                    const v = numberOrNull(e.target.value);
                    if (v != null) setP((prev) => ({ ...prev, latitude: v }));
                  }}
                  onBlur={() => patch({ latitude: p.latitude })}
                  className={`${numericInputCls} mt-1 font-mono`}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">Longitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={p.longitude}
                  onChange={(e) => {
                    const v = numberOrNull(e.target.value);
                    if (v != null) setP((prev) => ({ ...prev, longitude: v }));
                  }}
                  onBlur={() => patch({ longitude: p.longitude })}
                  className={`${numericInputCls} mt-1 font-mono`}
                />
              </label>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
              <OverlayColorSwatch
                lat={p.latitude}
                lng={p.longitude}
                size={12}
                propertyId={p.id}
              />
              <span>Crime overlay color sample</span>
            </div>
            {p.is_disliked && (
              <label className="block mt-3">
                <span className="text-xs text-orange-300">
                  Downvote reason (shown on hover)
                </span>
                <input
                  value={p.dislike_reason}
                  onChange={(e) =>
                    setP((prev) => ({ ...prev, dislike_reason: e.target.value }))
                  }
                  onBlur={() => patch({ dislike_reason: p.dislike_reason })}
                  className={`${inputCls} mt-1`}
                  placeholder="e.g. too far from work, no parking"
                />
              </label>
            )}
          </section>

          <section>
            <label className="block">
              <span className="text-xs text-zinc-400">
                Available from (optional)
              </span>
              <input
                type="date"
                value={p.availability_date ?? ""}
                onChange={(e) =>
                  patch({ availability_date: e.target.value || null })
                }
                className={`${inputCls} mt-1`}
              />
            </label>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="block">
              <span className="text-xs text-zinc-400">Price ($/mo)</span>
              <input
                type="number"
                inputMode="numeric"
                value={p.price ?? ""}
                onChange={(e) => patch({ price: intOrNull(e.target.value) })}
                className={`${numericInputCls} mt-1`}
                placeholder="—"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Beds</span>
              <input
                type="number"
                inputMode="numeric"
                value={p.beds ?? ""}
                onChange={(e) => patch({ beds: intOrNull(e.target.value) })}
                className={`${numericInputCls} mt-1`}
                placeholder="—"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Baths</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={p.baths ?? ""}
                onChange={(e) => patch({ baths: numberOrNull(e.target.value) })}
                className={`${numericInputCls} mt-1`}
                placeholder="—"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Sqft</span>
              <input
                type="number"
                inputMode="numeric"
                value={p.square_feet ?? ""}
                onChange={(e) =>
                  patch({ square_feet: intOrNull(e.target.value) })
                }
                className={`${numericInputCls} mt-1`}
                placeholder="—"
              />
            </label>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-zinc-400">Property type</span>
              <div className="mt-1 flex gap-2">
                {(["condo", "apartment"] as PropertyType[]).map((t) => {
                  const active = p.property_type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => patch({ property_type: t })}
                      className={`flex-1 rounded border px-3 py-1.5 text-xs transition ${
                        active
                          ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                          : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      {t === "condo" ? "Condo" : "Apartment"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-zinc-400">Tour status</span>
                <select
                  value={p.tour_status}
                  onChange={(e) =>
                    patch({ tour_status: e.target.value as TourStatus })
                  }
                  className={`${inputCls} mt-1`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">Stars</span>
                <select
                  value={p.star_rating ?? ""}
                  onChange={(e) =>
                    patch({
                      star_rating: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  className={`${inputCls} mt-1`}
                >
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <span className="text-xs text-zinc-400">Listing URLs</span>
            <div className="space-y-1.5 mt-1">
              {p.listing_urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={u}
                    onChange={(e) => setUrlAt(i, e.target.value)}
                    onBlur={commitUrls}
                    className={inputCls}
                    placeholder="https://…"
                  />
                  {u.trim() && (
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-400 hover:text-zinc-200 self-center px-1"
                      title="Open listing"
                    >
                      ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUrl(i)}
                    className="text-zinc-500 hover:text-zinc-200 px-1"
                    aria-label="Remove URL"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addUrl}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                + Add URL
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400">Pros</h3>
              {p.pros.map((entry, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <input
                    value={entry}
                    onChange={(e) => setProAt(i, e.target.value)}
                    className={inputCls}
                  />
                  <button
                    onClick={() => removePro(i)}
                    className="text-zinc-500 hover:text-zinc-200"
                    aria-label="Remove pro"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addPro}
                className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
              >
                + Add pro
              </button>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-rose-400">Cons</h3>
              {p.cons.map((entry, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <input
                    value={entry}
                    onChange={(e) => setConAt(i, e.target.value)}
                    className={inputCls}
                  />
                  <button
                    onClick={() => removeCon(i)}
                    className="text-zinc-500 hover:text-zinc-200"
                    aria-label="Remove con"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addCon}
                className="mt-2 text-xs text-rose-400 hover:text-rose-300"
              >
                + Add con
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400">
                Units at this address{" "}
                {siblings.length > 0 && `(${siblings.length + 1})`}
              </span>
              {onAddUnit && (
                <button
                  type="button"
                  onClick={onAddUnit}
                  className="text-xs border border-zinc-700 rounded px-2 py-1 hover:bg-zinc-800 text-zinc-200"
                  title="Add another unit at this address"
                >
                  + Add unit
                </button>
              )}
            </div>
            {siblings.length === 0 ? (
              <div className="text-xs text-zinc-500 italic">
                No other units at {stripUnitSuffix(p.address) || "this address"}.
                Click &ldquo;+ Add unit&rdquo; to add another.
              </div>
            ) : (
              <ul className="space-y-1">
                {siblings.map((s) => {
                  const labelMatch = s.address.match(/\(([^)]*)\)\s*$/);
                  const unitLabel = labelMatch ? labelMatch[1] : null;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSwitchProperty?.(s.id)}
                        className="w-full text-left flex items-center justify-between gap-2 border border-zinc-800 hover:border-zinc-600 bg-zinc-900/40 hover:bg-zinc-900 rounded px-2 py-1.5 transition"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-sm text-zinc-100">
                            {unitLabel ? `Unit ${unitLabel}` : s.address}
                          </span>
                          <span className="block text-xs text-zinc-500 truncate">
                            {s.price ? `$${s.price.toLocaleString()}` : "—"}
                            {s.beds != null && ` · ${s.beds}bd`}
                            {s.baths != null && ` ${s.baths}ba`}
                            {s.square_feet != null &&
                              ` · ${s.square_feet.toLocaleString()} sqft`}
                          </span>
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          edit →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <span className="text-xs text-zinc-400">Notes</span>
            <textarea
              value={p.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 mt-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
              placeholder="Free-form thoughts…"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
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
      width="18"
      height="18"
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
