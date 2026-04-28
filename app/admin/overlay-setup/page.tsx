"use client";

import { useRef, useState } from "react";
import { CRIME_OVERLAY } from "@/lib/overlay-config";

interface RefPoint {
  pxX: number;
  pxY: number;
  lat: number;
  lng: number;
}

export default function OverlaySetup() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [points, setPoints] = useState<RefPoint[]>([]);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [pending, setPending] = useState<{ x: number; y: number } | null>(
    null,
  );

  const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const target = e.currentTarget as HTMLImageElement;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (target.naturalWidth / rect.width);
    const y = (e.clientY - rect.top) * (target.naturalHeight / rect.height);
    setPending({ x, y });
  };

  const confirm = () => {
    if (!pending) return;
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPoints([...points, { pxX: pending.x, pxY: pending.y, lat, lng }]);
    setPending(null);
    setLatInput("");
    setLngInput("");
  };

  const bounds = computeBounds(points, imgRef.current);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Overlay Setup</h1>
      <p className="mb-4 text-sm text-gray-600">
        Click two reference points on the screenshot, entering each one&apos;s
        real lat/lng. Two points are enough to compute bounds (Web Mercator
        near a city is well-approximated as axis-aligned over ~30 miles).
      </p>
      <img
        ref={imgRef}
        src={CRIME_OVERLAY.imageUrl}
        alt="Crime overlay"
        onClick={onClick}
        className="border max-w-full cursor-crosshair"
      />
      {pending && (
        <div className="mt-4 p-4 border rounded space-y-2">
          <div>
            Pixel: ({pending.x.toFixed(0)}, {pending.y.toFixed(0)})
          </div>
          <input
            placeholder="Latitude"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            className="border rounded px-2 py-1 mr-2"
          />
          <input
            placeholder="Longitude"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            className="border rounded px-2 py-1 mr-2"
          />
          <button
            onClick={confirm}
            className="bg-black text-white rounded px-3 py-1"
          >
            Add point
          </button>
        </div>
      )}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Points: {points.length}/2</h2>
        <ul className="text-sm">
          {points.map((p, i) => (
            <li key={i}>
              ({p.pxX.toFixed(0)}, {p.pxY.toFixed(0)}) → {p.lat}, {p.lng}
            </li>
          ))}
        </ul>
      </div>
      {bounds && (
        <pre className="mt-6 bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap">
{`Paste this into lib/overlay-config.ts as the bounds field:

bounds: [${bounds.s.toFixed(6)}, ${bounds.w.toFixed(6)}, ${bounds.n.toFixed(6)}, ${bounds.e.toFixed(6)}] as [number, number, number, number],`}
        </pre>
      )}
    </main>
  );
}

function computeBounds(points: RefPoint[], img: HTMLImageElement | null) {
  if (points.length < 2 || !img) return null;
  const [a, b] = points;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const dLatPerPy = (b.lat - a.lat) / (b.pxY - a.pxY);
  const dLngPerPx = (b.lng - a.lng) / (b.pxX - a.pxX);
  const latAtTop = a.lat - dLatPerPy * a.pxY;
  const latAtBottom = a.lat + dLatPerPy * (H - a.pxY);
  const lngAtLeft = a.lng - dLngPerPx * a.pxX;
  const lngAtRight = a.lng + dLngPerPx * (W - a.pxX);
  const n = Math.max(latAtTop, latAtBottom);
  const s = Math.min(latAtTop, latAtBottom);
  const e = Math.max(lngAtLeft, lngAtRight);
  const w = Math.min(lngAtLeft, lngAtRight);
  return { n, s, e, w };
}
