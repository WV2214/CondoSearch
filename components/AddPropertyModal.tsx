"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ManualGeoPicker = dynamic(() => import("./ManualGeoPicker"), {
  ssr: false,
});

interface ScrapeResp {
  scraped: {
    address: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    square_feet: number | null;
    photo_url: string | null;
  };
  latitude: number | null;
  longitude: number | null;
  geocode_confidence: "high" | "low" | "none";
}

export function AddPropertyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"url" | "review">("url");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScrapeResp | null>(null);
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [baths, setBaths] = useState<string>("");
  const [sqft, setSqft] = useState<string>("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");

  const doScrape = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "scrape failed");
      }
      const d: ScrapeResp = await res.json();
      setData(d);
      setAddress(d.scraped.address ?? "");
      setPrice(d.scraped.price?.toString() ?? "");
      setBeds(d.scraped.beds?.toString() ?? "");
      setBaths(d.scraped.baths?.toString() ?? "");
      setSqft(d.scraped.square_feet?.toString() ?? "");
      setLat(d.latitude?.toString() ?? "");
      setLng(d.longitude?.toString() ?? "");
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (!address || !Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setError("Address and a valid lat/lng are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_url: url,
          address,
          latitude: latN,
          longitude: lngN,
          price: price ? parseInt(price, 10) : null,
          beds: beds ? parseInt(beds, 10) : null,
          baths: baths ? parseFloat(baths) : null,
          square_feet: sqft ? parseInt(sqft, 10) : null,
          photo_path: null,
          photo_source_url: data?.scraped.photo_url ?? null,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "save failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Add property</h2>
          <button onClick={onClose} className="text-gray-500">
            ✕
          </button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {step === "url" && (
          <div className="space-y-3">
            <input
              placeholder="Paste listing URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={doScrape}
                disabled={busy || !url}
                className="flex-1 bg-black text-white rounded py-2 disabled:opacity-50"
              >
                {busy ? "Scraping..." : "Continue"}
              </button>
              <button
                onClick={() => setStep("review")}
                className="flex-1 border rounded py-2"
              >
                Skip and enter manually
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {(data?.geocode_confidence === "low" || !lat || !lng) && (
              <div className="text-sm text-amber-700">
                Geocode confidence is low or missing. Drag the pin to the
                correct location.
              </div>
            )}
            <Field label="Address">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price ($/mo)">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </Field>
              <Field label="Sq ft">
                <input
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </Field>
              <Field label="Beds">
                <input
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </Field>
              <Field label="Baths">
                <input
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </Field>
            </div>
            <Field label="Latitude / Longitude">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </Field>
            <ManualGeoPicker
              lat={parseFloat(lat) || 29.76}
              lng={parseFloat(lng) || -95.37}
              onChange={(la, ln) => {
                setLat(la.toString());
                setLng(ln.toString());
              }}
            />
            <button
              onClick={save}
              disabled={busy}
              className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save property"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
