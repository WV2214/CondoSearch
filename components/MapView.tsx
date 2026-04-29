"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer } from "react-leaflet";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Property, TourStatus } from "@/lib/types/property";
import { CrimeOverlay } from "./CrimeOverlay";
import { PropertyPins } from "./PropertyPins";
import { AddPropertyButton } from "./AddPropertyButton";
import { Sidebar, type SortKey } from "./Sidebar";
import { OverlayEditor } from "./OverlayEditor";
import { OverlayColorPicker } from "./OverlayColorPicker";
import { clearOverride } from "@/lib/overlay-color-overrides";
import {
  CRIME_OVERLAY,
  DEFAULT_OVERLAY_OPACITY,
  loadStoredBounds,
  saveStoredBounds,
  clearStoredBounds,
  loadStoredOpacity,
  saveStoredOpacity,
  type Bounds,
} from "@/lib/overlay-config";

const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

export default function MapView() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [overlayMode, setOverlayMode] = useState<"auto" | "on" | "off">(
    "auto",
  );
  const [filter, setFilter] = useState<Set<TourStatus>>(new Set());
  const [sort, setSort] = useState<SortKey>("my_ranking");
  const [bounds, setBounds] = useState<Bounds>(CRIME_OVERLAY.bounds);
  const [opacity, setOpacity] = useState<number>(DEFAULT_OVERLAY_OPACITY);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickingForId, setPickingForId] = useState<string | null>(null);
  const [pickFlash, setPickFlash] = useState<
    | { kind: "ok"; hex: string; address: string }
    | { kind: "miss" }
    | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedBounds = loadStoredBounds();
    if (storedBounds) setBounds(storedBounds);
    const storedOpacity = loadStoredOpacity();
    if (storedOpacity != null) setOpacity(storedOpacity);
  }, []);

  const handleOpacityChange = (v: number) => {
    setOpacity(v);
    saveStoredOpacity(v);
  };

  const refresh = useCallback(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties(d.properties ?? []));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = (p: Property) => {
    setSelectedId(p.id);
    mapRef.current?.flyTo([p.latitude, p.longitude], 16, { duration: 0.6 });
  };

  const forceVisible =
    overlayMode === "auto" ? null : overlayMode === "on";

  const handleBoundsChange = (b: Bounds) => {
    setBounds(b);
    saveStoredBounds(b);
  };

  const resetBounds = () => {
    clearStoredBounds();
    setBounds(CRIME_OVERLAY.bounds);
  };

  const pickingProperty = pickingForId
    ? properties.find((p) => p.id === pickingForId) ?? null
    : null;

  const exitPicking = useCallback(() => {
    setPickingForId(null);
  }, []);

  const handlePicked = useCallback(
    (hex: string) => {
      const addr = pickingProperty?.address ?? "property";
      setPickFlash({ kind: "ok", hex, address: addr });
      setPickingForId(null);
      setTimeout(() => setPickFlash(null), 2000);
    },
    [pickingProperty],
  );

  const handleMissed = useCallback(() => {
    setPickFlash({ kind: "miss" });
    setTimeout(() => setPickFlash(null), 2000);
  }, []);

  const handleClearOverride = useCallback((id: string) => {
    clearOverride(id);
  }, []);

  const copyBoundsLine = async () => {
    const [s, w, n, e] = bounds;
    const line = `bounds: [${s.toFixed(6)}, ${w.toFixed(6)}, ${n.toFixed(6)}, ${e.toFixed(6)}] as Bounds,`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this line into lib/overlay-config.ts:", line);
    }
  };

  return (
    <div className="relative w-screen h-screen md:flex">
      <div className="relative h-full md:flex-1">
        <MapContainer
          center={HOUSTON_CENTER}
          zoom={11}
          scrollWheelZoom
          className="w-full h-full"
          ref={(m) => {
            mapRef.current = m;
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CrimeOverlay
            forceVisible={editing ? true : forceVisible}
            bounds={bounds}
            opacity={opacity}
            ignoreZoomAutoHide={editing}
          />
          {editing && (
            <OverlayEditor bounds={bounds} onChange={handleBoundsChange} />
          )}
          {pickingForId && (
            <OverlayColorPicker
              propertyId={pickingForId}
              onPicked={handlePicked}
              onMissed={handleMissed}
            />
          )}
          <PropertyPins
            properties={properties}
            onMoved={refresh}
            onPinClick={setSelectedId}
          />
        </MapContainer>
        {(pickingProperty || pickFlash) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-3 bg-zinc-900/95 text-zinc-100 border border-amber-500/60 shadow-lg rounded px-4 py-2 text-sm">
            {pickingProperty ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  Click on the overlay to set color for{" "}
                  <span className="font-semibold">
                    {pickingProperty.address}
                  </span>
                </span>
                <button
                  onClick={exitPicking}
                  className="ml-2 border border-zinc-600 rounded px-2 py-0.5 text-xs hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </>
            ) : pickFlash?.kind === "ok" ? (
              <>
                <span
                  className="inline-block w-3 h-3 rounded-full border border-black/40"
                  style={{ background: pickFlash.hex }}
                />
                <span>
                  Set overlay color for{" "}
                  <span className="font-semibold">{pickFlash.address}</span> to{" "}
                  {pickFlash.hex}
                </span>
              </>
            ) : (
              <span>That click was outside the overlay — try again.</span>
            )}
          </div>
        )}
        <Link
          href="/compare"
          className="absolute top-4 left-4 z-[1000] bg-zinc-900/95 text-zinc-100 border border-zinc-700 shadow-lg rounded px-3 py-2 text-sm hover:bg-zinc-800"
        >
          Compare
        </Link>
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          <div className="bg-zinc-900/95 text-zinc-100 border border-zinc-700 shadow-lg rounded px-3 py-2 text-sm flex flex-col gap-2 w-56">
            <button
              onClick={() =>
                setOverlayMode(
                  overlayMode === "auto"
                    ? "off"
                    : overlayMode === "off"
                      ? "on"
                      : "auto",
                )
              }
              className="text-left hover:text-amber-300"
            >
              Crime overlay: {overlayMode}
            </button>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-12 shrink-0">Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) =>
                  handleOpacityChange(parseFloat(e.target.value))
                }
                className="flex-1 accent-amber-400"
              />
              <span className="w-8 text-right text-zinc-300">
                {Math.round(opacity * 100)}%
              </span>
            </label>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className={`shadow-lg rounded px-3 py-2 text-sm border transition ${
              editing
                ? "bg-amber-400 text-zinc-900 border-amber-300 hover:bg-amber-300"
                : "bg-zinc-900/95 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            {editing ? "Done editing" : "Edit overlay"}
          </button>
          {editing && (
            <div className="flex flex-col gap-2 bg-zinc-900/95 border border-zinc-700 rounded p-2 shadow-lg w-64 text-xs text-zinc-300">
              <div>
                Drag the four yellow corners to resize. Drag the white
                center handle to move. Changes auto-save to this browser.
              </div>
              <button
                onClick={copyBoundsLine}
                className="bg-zinc-100 text-zinc-900 rounded px-2 py-1 font-medium hover:bg-white"
              >
                {copied ? "Copied!" : "Copy bounds line"}
              </button>
              <button
                onClick={resetBounds}
                className="border border-zinc-700 rounded px-2 py-1 hover:bg-zinc-800"
              >
                Reset to config defaults
              </button>
            </div>
          )}
        </div>
        <AddPropertyButton onSaved={refresh} />
      </div>
      <Sidebar
        properties={properties}
        onSelect={onSelect}
        onChanged={refresh}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        pickingForId={pickingForId}
        onStartPick={setPickingForId}
        onClearOverride={handleClearOverride}
        selectedId={selectedId}
      />
    </div>
  );
}
