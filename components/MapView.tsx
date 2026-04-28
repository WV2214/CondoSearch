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

const HOUSTON_CENTER: [number, number] = [29.76, -95.37];

export default function MapView() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [overlayMode, setOverlayMode] = useState<"auto" | "on" | "off">(
    "auto",
  );
  const [filter, setFilter] = useState<Set<TourStatus>>(new Set());
  const [sort, setSort] = useState<SortKey>("default");
  const mapRef = useRef<L.Map | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setProperties(d.properties ?? []));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = (p: Property) => {
    mapRef.current?.flyTo([p.latitude, p.longitude], 16, { duration: 0.6 });
  };

  const forceVisible =
    overlayMode === "auto" ? null : overlayMode === "on";

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
          <CrimeOverlay forceVisible={forceVisible} />
          <PropertyPins properties={properties} />
        </MapContainer>
        <Link
          href="/compare"
          className="absolute top-4 left-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
        >
          Compare
        </Link>
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
          className="absolute top-4 right-4 z-[1000] bg-white shadow rounded px-3 py-2 text-sm"
        >
          Crime overlay: {overlayMode}
        </button>
        <AddPropertyButton onSaved={refresh} />
      </div>
      <Sidebar
        properties={properties}
        onSelect={onSelect}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
      />
    </div>
  );
}
