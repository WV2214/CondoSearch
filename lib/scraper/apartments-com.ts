import * as cheerio from "cheerio";
import type { ScrapeResult } from "./og";
import { parseOgFallback } from "./og";

export function parseApartmentsCom(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const fallback = parseOgFallback(html);

  const address =
    $("[data-tagname='propertyAddress']").text().trim() ||
    $(".propertyAddressContainer").text().trim() ||
    fallback.address;

  const price =
    parsePriceText($(".rentInfoDetail").first().text()) ?? fallback.price;

  const bedsText = $(".bedRangeBath").first().text();
  const beds = matchInt(bedsText, /(\d+)\s*bed/i) ?? fallback.beds;
  const baths = matchFloat(bedsText, /(\d+(?:\.\d)?)\s*bath/i) ?? fallback.baths;
  const sqft =
    matchInt($(".sqftRange").first().text(), /([\d,]+)/) ?? fallback.square_feet;

  const photo =
    $("meta[property='og:image']").attr("content") ?? fallback.photo_url;

  return {
    address: address || null,
    price,
    beds,
    baths,
    square_feet: sqft,
    photo_url: photo,
  };
}

function parsePriceText(s: string): number | null {
  const m = s.match(/\$\s*([\d,]+)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function matchInt(s: string, re: RegExp): number | null {
  const m = s.match(re);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function matchFloat(s: string, re: RegExp): number | null {
  const m = s.match(re);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}
