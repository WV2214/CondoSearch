"use client";

import { useEffect, useState } from "react";
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

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500";

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
  const [geocoding, setGeocoding] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    setInfo(null);
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

      const allNull =
        !d.scraped.address &&
        !d.scraped.price &&
        !d.scraped.beds &&
        !d.scraped.baths &&
        !d.scraped.square_feet &&
        !d.scraped.photo_url;
      if (allNull) {
        setInfo(
          "The listing site blocked us or the parser couldn't find anything. Fill in the fields manually below.",
        );
      }
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    } finally {
      setBusy(false);
    }
  };

  const extractFromImage = async (file: File) => {
    setExtracting(true);
    setError(null);
    setInfo("Reading screenshot with Claude vision...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/properties/extract-from-image", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "extraction failed");
      }
      const j = await res.json();
      const x = j.extracted as {
        address: string | null;
        price: number | null;
        beds: number | null;
        baths: number | null;
        square_feet: number | null;
      };
      if (x.address) setAddress(x.address);
      if (x.price != null) setPrice(String(x.price));
      if (x.beds != null) setBeds(String(x.beds));
      if (x.baths != null) setBaths(String(x.baths));
      if (x.square_feet != null) setSqft(String(x.square_feet));
      setInfo(
        "Extracted from screenshot. Review the fields, then either click 'Find on map' to geocode the address or drag the pin manually before saving.",
      );
      setStep("review");

      if (x.address) {
        try {
          const g = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: x.address }),
          });
          if (g.ok) {
            const gj = await g.json();
            if (gj.latitude != null && gj.longitude != null) {
              setLat(String(gj.latitude));
              setLng(String(gj.longitude));
            }
          }
        } catch {
          // Non-fatal — user can geocode manually.
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setInfo(null);
    } finally {
      setExtracting(false);
    }
  };

  // Listen for clipboard paste of an image while the modal is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            extractFromImage(f);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geocodeAddressNow = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error("geocode failed");
      const j = (await res.json()) as {
        latitude: number | null;
        longitude: number | null;
        confidence: "high" | "low" | "none";
      };
      if (j.latitude == null || j.longitude == null) {
        setError(
          "Couldn't find that address. Drag the pin on the map to set the location.",
        );
      } else {
        setLat(j.latitude.toString());
        setLng(j.longitude.toString());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGeocoding(false);
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000] p-4">
      <div className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Add property</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        {error && (
          <div className="text-red-300 text-sm bg-red-950/40 border border-red-900 rounded px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-blue-200 text-sm bg-blue-950/30 border border-blue-900 rounded px-3 py-2">
            {info}
          </div>
        )}

        {step === "url" && (
          <div className="space-y-3">
            <input
              placeholder="Paste listing URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputCls}
            />
            <div className="flex gap-2">
              <button
                onClick={doScrape}
                disabled={busy || !url}
                className="flex-1 bg-zinc-100 text-zinc-900 rounded py-2 font-medium disabled:opacity-50 hover:bg-white"
              >
                {busy ? "Scraping..." : "Continue"}
              </button>
              <button
                onClick={() => setStep("review")}
                className="flex-1 border border-zinc-700 rounded py-2 hover:bg-zinc-800"
              >
                Skip and enter manually
              </button>
            </div>

            <div className="border-t border-zinc-800 pt-4 mt-4">
              <div className="text-sm text-zinc-300 font-medium mb-1">
                Or paste a screenshot
              </div>
              <div className="text-xs text-zinc-500 mb-3">
                Faster than the URL when sites block scraping. Press Ctrl+V
                anywhere in this modal, or use the button below.
              </div>
              <label
                className={`block border-2 border-dashed border-zinc-700 rounded p-4 text-center text-sm cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/50 transition ${
                  extracting ? "opacity-50 cursor-wait" : ""
                }`}
              >
                {extracting
                  ? "Reading screenshot..."
                  : "Click to upload, or paste an image (Ctrl+V)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={extracting}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) extractFromImage(f);
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {(data?.geocode_confidence === "low" || !lat || !lng) && (
              <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900 rounded px-3 py-2">
                Geocode confidence is low or missing. Drag the pin to the
                correct location.
              </div>
            )}
            <Field label="Address">
              <div className="flex gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={geocodeAddressNow}
                  disabled={geocoding || !address.trim()}
                  className="shrink-0 border border-zinc-700 rounded px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  {geocoding ? "..." : "Find on map"}
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price ($/mo)">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Sq ft">
                <input
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Beds">
                <input
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Baths">
                <input
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Latitude / Longitude">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className={inputCls}
                />
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className={inputCls}
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
              className="w-full bg-zinc-100 text-zinc-900 rounded py-2 font-medium disabled:opacity-50 hover:bg-white"
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
      <span className="text-zinc-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
