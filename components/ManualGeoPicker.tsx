"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";

const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

export default function ManualGeoPicker({ lat, lng, onChange }: Props) {
  return (
    <div className="h-48 w-full rounded overflow-hidden border">
      <MapContainer center={[lat, lng]} zoom={13} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
      </MapContainer>
    </div>
  );
}

function DraggableMarker({ lat, lng, onChange }: Props) {
  const [position, setPosition] = useState<[number, number]>([lat, lng]);
  useEffect(() => setPosition([lat, lng]), [lat, lng]);
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <Marker
      position={position}
      icon={defaultIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          setPosition([ll.lat, ll.lng]);
          onChange(ll.lat, ll.lng);
        },
      }}
    />
  );
}
