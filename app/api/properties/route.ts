import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { propertyInsertSchema } from "@/lib/types/property";
import { cachePhotoToStorage } from "@/lib/photos";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ properties: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = propertyInsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { photo_source_url, ...row } = parsed.data;

  const { data: inserted, error } = await supabase
    .from("properties")
    .insert({ ...row, user_id: user.id })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let photo_path: string | null = inserted.photo_path;
  if (!photo_path && photo_source_url) {
    photo_path = await cachePhotoToStorage(
      photo_source_url,
      user.id,
      inserted.id,
    );
    if (photo_path) {
      await supabase
        .from("properties")
        .update({ photo_path })
        .eq("id", inserted.id);
    }
  }

  return NextResponse.json({ property: { ...inserted, photo_path } });
}
