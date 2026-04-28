import { parseOgFallback } from "./og";
import type { ScrapeResult } from "./og";

export function parseZillow(html: string): ScrapeResult {
  // Zillow's HTML is JS-rendered behind aggressive bot detection.
  // The OG fallback usually still gets us address, price, photo, sometimes beds/baths from the share-card text.
  // Refine here once a real fixture is captured.
  return parseOgFallback(html);
}
