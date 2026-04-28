import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseApartmentsCom } from "./apartments-com";
import { parseZillow } from "./zillow";
import { parseTrulia } from "./trulia";
import { parseOgFallback } from "./og";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("parseOgFallback", () => {
  it("extracts address, price, beds, baths, sqft, image from a generic listing-style title", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="123 Main St, Houston, TX 77004" />
        <meta property="og:description" content="2 bd 1.5 ba 870 sqft - $1,000/mo" />
        <meta property="og:image" content="https://example.com/photo.jpg" />
      </head><body></body></html>`;
    const r = parseOgFallback(html);
    expect(r.address).toBe("123 Main St, Houston, TX 77004");
    expect(r.price).toBe(1000);
    expect(r.beds).toBe(2);
    expect(r.baths).toBe(1.5);
    expect(r.square_feet).toBe(870);
    expect(r.photo_url).toBe("https://example.com/photo.jpg");
  });

  it("returns nulls when meta tags are missing", () => {
    const r = parseOgFallback("<html><head></head><body></body></html>");
    expect(r.address).toBeNull();
    expect(r.price).toBeNull();
    expect(r.photo_url).toBeNull();
  });
});

describe("parseApartmentsCom", () => {
  it("falls back to og fields when domain selectors miss", () => {
    const html = fixture("apartments-com.html");
    const r = parseApartmentsCom(html);
    expect(r.photo_url).toBeTruthy();
    expect(r.address).toContain("Hornwood");
    expect(r.price).toBe(1000);
    expect(r.beds).toBe(2);
  });
});

describe("parseZillow", () => {
  it("extracts via og fallback", () => {
    const html = fixture("zillow.html");
    const r = parseZillow(html);
    expect(r.address).toContain("Fairbanks");
    expect(r.price).toBe(1100);
  });
});

describe("parseTrulia", () => {
  it("extracts via og fallback", () => {
    const html = fixture("trulia.html");
    const r = parseTrulia(html);
    expect(r.address).toContain("Hazard");
    expect(r.price).toBe(975);
  });
});
