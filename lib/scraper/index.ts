import { parseApartmentsCom } from "./apartments-com";
import { parseZillow } from "./zillow";
import { parseTrulia } from "./trulia";
import { parseOgFallback } from "./og";
import type { ScrapeResult } from "./og";

export type { ScrapeResult } from "./og";

export async function scrapeListing(url: string): Promise<ScrapeResult> {
  const empty: ScrapeResult = {
    address: null,
    price: null,
    beds: null,
    baths: null,
    square_feet: null,
    photo_url: null,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
  } catch {
    return empty;
  }
  if (!res.ok) return empty;

  const html = await res.text();
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("apartments.com")) return parseApartmentsCom(html);
  if (host.includes("zillow.com")) return parseZillow(html);
  if (host.includes("trulia.com")) return parseTrulia(html);
  return parseOgFallback(html);
}
