import { parseOgFallback } from "./og";
import type { ScrapeResult } from "./og";

export function parseTrulia(html: string): ScrapeResult {
  // Same situation as Zillow — bot-protected. OG fallback first; refine after capturing a fixture.
  return parseOgFallback(html);
}
