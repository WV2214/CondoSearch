import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddressMulti } from "@/lib/geocode";

const bodySchema = z.object({ address: z.string().min(1) });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const candidates = await geocodeAddressMulti(parsed.data.address);
  if (candidates.length === 0) {
    return NextResponse.json({
      latitude: null,
      longitude: null,
      confidence: "none",
      displayName: null,
      candidates: [],
    });
  }
  const top = candidates[0];
  return NextResponse.json({
    latitude: top.latitude,
    longitude: top.longitude,
    confidence: top.confidence,
    displayName: top.displayName,
    candidates,
  });
}
