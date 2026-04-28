import { createAdminClient } from "@/lib/supabase/admin";

export const PHOTO_BUCKET = "property-photos";

let ensurePromise: Promise<void> | null = null;

export function ensurePhotoBucket(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    const admin = createAdminClient();
    const { data, error: listErr } = await admin.storage.listBuckets();
    if (listErr) {
      ensurePromise = null;
      throw new Error(`listBuckets: ${listErr.message}`);
    }
    if (data?.some((b) => b.name === PHOTO_BUCKET)) return;
    const { error } = await admin.storage.createBucket(PHOTO_BUCKET, {
      public: true,
    });
    if (error && !/already exists/i.test(error.message)) {
      ensurePromise = null;
      throw new Error(`createBucket: ${error.message}`);
    }
  })();
  return ensurePromise;
}

export async function cachePhotoToStorage(
  sourceUrl: string,
  userId: string,
  propertyId: string,
): Promise<string | null> {
  try {
    await ensurePhotoBucket();
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "CondoSearch/1.0" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${userId}/${propertyId}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(path, buf, { contentType, upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export function publicPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
