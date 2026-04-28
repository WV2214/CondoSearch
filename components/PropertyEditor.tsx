"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "./photo-url";

const STATUSES: TourStatus[] = [
  "not_toured",
  "scheduled",
  "toured",
  "rejected",
  "top_pick",
];

const STATUS_LABEL: Record<TourStatus, string> = {
  not_toured: "Not toured",
  scheduled: "Scheduled",
  toured: "Toured",
  rejected: "Rejected",
  top_pick: "Top pick",
};

const inputCls =
  "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500";

export function PropertyEditor({ initial }: { initial: Property }) {
  const router = useRouter();
  const [p, setP] = useState<Property>(initial);
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = (patchData: Partial<Property>) => {
    setP({ ...p, ...patchData });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await fetch(`/api/properties/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
    }, 500);
  };

  const remove = async () => {
    if (!confirm("Delete this property?")) return;
    await fetch(`/api/properties/${p.id}`, { method: "DELETE" });
    router.push("/");
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
        setP({ ...p, photo_path });
      }
    } finally {
      setUploading(false);
    }
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Back to map
            </Link>
            <h1 className="text-2xl font-semibold mt-2 truncate">
              {p.address}
            </h1>
            <div className="text-zinc-400 mt-1">
              {p.price ? `$${p.price.toLocaleString()}/mo` : "Price unknown"}
              {p.beds != null && ` · ${p.beds}bd`}
              {p.baths != null && ` ${p.baths}ba`}
              {p.square_feet != null &&
                ` · ${p.square_feet.toLocaleString()} sqft`}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={p.listing_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm border border-zinc-700 rounded px-3 py-2 hover:bg-zinc-900"
            >
              Open listing
            </a>
            <button
              onClick={remove}
              className="text-sm border border-red-900 text-red-300 rounded px-3 py-2 hover:bg-red-950/40"
            >
              Delete
            </button>
          </div>
        </div>

        <div>
          {p.photo_path ? (
            <img
              src={publicPhotoUrl(p.photo_path)}
              alt={p.address}
              className="w-full rounded border border-zinc-800"
            />
          ) : (
            <div className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-500">
              No photo
            </div>
          )}
          <label className="inline-block mt-2 text-sm border border-zinc-700 rounded px-3 py-1 cursor-pointer hover:bg-zinc-900">
            {uploading ? "Uploading..." : "Replace photo"}
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

        <section className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-zinc-300">Tour status</span>
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
            <span className="text-sm text-zinc-300">Star rating</span>
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
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="font-semibold text-green-400">Pros</h2>
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
              className="mt-2 text-sm text-green-400 hover:text-green-300"
            >
              + Add pro
            </button>
          </div>
          <div>
            <h2 className="font-semibold text-red-400">Cons</h2>
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
              className="mt-2 text-sm text-red-400 hover:text-red-300"
            >
              + Add con
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-semibold">Notes</h2>
          <textarea
            value={p.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={6}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 mt-1 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="Free-form thoughts..."
          />
        </section>
      </div>
    </main>
  );
}
