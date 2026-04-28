import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { scrapeListing } from "@/lib/scraper";
import { geocodeAddress } from "@/lib/geocode";

const bodySchema = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const scraped = await scrapeListing(body.data.url);

  let latitude: number | null = null;
  let longitude: number | null = null;
  let geocode_confidence: "high" | "low" | "none" = "none";
  if (scraped.address) {
    const g = await geocodeAddress(scraped.address);
    if (g) {
      latitude = g.latitude;
      longitude = g.longitude;
      geocode_confidence = g.confidence;
    }
  }

  return NextResponse.json({
    scraped,
    latitude,
    longitude,
    geocode_confidence,
  });
}
