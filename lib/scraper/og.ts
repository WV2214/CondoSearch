import * as cheerio from "cheerio";

export interface ScrapeResult {
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  square_feet: number | null;
  photo_url: string | null;
}

export function parseOgFallback(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const og = (prop: string) =>
    $(`meta[property="${prop}"]`).attr("content") ||
    $(`meta[name="${prop}"]`).attr("content") ||
    null;

  const title = og("og:title") ?? $("title").text() ?? null;
  const description = og("og:description") ?? null;
  const image = og("og:image") ?? null;

  const text = `${title ?? ""} ${description ?? ""}`;
  const price = matchPrice(text);
  const beds = matchBeds(text);
  const baths = matchBaths(text);
  const sqft = matchSqft(text);
  const address = guessAddress(title);

  return {
    address,
    price,
    beds,
    baths,
    square_feet: sqft,
    photo_url: image,
  };
}

function matchPrice(s: string): number | null {
  const m = s.match(/\$\s*([\d,]+)(?:\s*\/?\s*(?:mo|month))?/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function matchBeds(s: string): number | null {
  const m = s.match(/(\d+)\s*(?:bd|bed|beds|bedroom)/i);
  return m ? parseInt(m[1], 10) : null;
}
function matchBaths(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d)?)\s*(?:ba|bath|baths|bathroom)/i);
  return m ? parseFloat(m[1]) : null;
}
function matchSqft(s: string): number | null {
  const m = s.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet)/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function guessAddress(title: string | null): string | null {
  if (!title) return null;
  const m = title.match(/([\d]+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})/);
  return m ? m[1] : null;
}
