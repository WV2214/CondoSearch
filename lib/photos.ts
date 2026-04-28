import { createAdminClient } from "@/lib/supabase/admin";

export async function cachePhotoToStorage(
  sourceUrl: string,
  userId: string,
  propertyId: string,
): Promise<string | null> {
  try {
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
      .from("property-photos")
      .upload(path, buf, { contentType, upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export function publicPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/property-photos/${path}`;
}
