import type { Bounds } from "@/lib/overlay-config";

let cachedImage: HTMLImageElement | null = null;
let cachedCanvas: HTMLCanvasElement | null = null;
let cachedCtx: CanvasRenderingContext2D | null = null;
let cachedUrl = "";

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

async function getCanvas(imageUrl: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} | null> {
  if (cachedUrl === imageUrl && cachedCanvas && cachedCtx) {
    return { canvas: cachedCanvas, ctx: cachedCtx };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      cachedImage = img;
      cachedCanvas = canvas;
      cachedCtx = ctx;
      cachedUrl = imageUrl;
      resolve({ canvas, ctx });
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

export async function sampleOverlayColor(
  lat: number,
  lng: number,
  imageUrl: string,
  bounds: Bounds,
): Promise<string | null> {
  const [southLat, westLng, northLat, eastLng] = bounds;

  if (lat < southLat || lat > northLat || lng < westLng || lng > eastLng) {
    return null;
  }

  const result = await getCanvas(imageUrl);
  if (!result) return null;
  const { canvas, ctx } = result;

  const u = (lng - westLng) / (eastLng - westLng);
  const v = (northLat - lat) / (northLat - southLat);

  // Sample a 3x3 neighborhood and average to reduce pixel-level noise
  const cx = Math.round(u * (canvas.width - 1));
  const cy = Math.round(v * (canvas.height - 1));
  const r1 = Math.max(0, cx - 1);
  const r2 = Math.min(canvas.width - 1, cx + 1);
  const r3 = Math.max(0, cy - 1);
  const r4 = Math.min(canvas.height - 1, cy + 1);
  const w = r2 - r1 + 1;
  const h = r4 - r3 + 1;

  const data = ctx.getImageData(r1, r3, w, h).data;

  let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    totalA += data[i + 3];
    count++;
  }

  if (count === 0 || totalA / count < 10) return null;

  return toHex(
    Math.round(totalR / count),
    Math.round(totalG / count),
    Math.round(totalB / count),
  );
}
