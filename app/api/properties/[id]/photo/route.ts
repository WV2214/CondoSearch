import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cachePhotoToStorage, ensurePhotoBucket, PHOTO_BUCKET } from "@/lib/photos";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let path: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { source_url?: unknown }
      | null;
    const sourceUrl =
      body && typeof body.source_url === "string" ? body.source_url : null;
    if (!sourceUrl) {
      return NextResponse.json({ error: "no source_url" }, { status: 400 });
    }
    path = await cachePhotoToStorage(sourceUrl, user.id, id);
    if (!path) {
      return NextResponse.json(
        { error: "failed to fetch source image" },
        { status: 502 },
      );
    }
  } else {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const fileType = file.type || "image/jpeg";
    const ext = fileType.includes("png") ? "png" : "jpg";
    path = `${user.id}/${id}.${ext}`;

    try {
      await ensurePhotoBucket();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "bucket setup failed" },
        { status: 500 },
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(path, buf, { contentType: fileType, upsert: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error: updErr } = await supabase
    .from("properties")
    .update({ photo_path: path })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ photo_path: path });
}
