import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${user.id}/${id}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("property-photos")
    .upload(path, buf, { contentType, upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
