import type { Property } from "@/lib/types/property";

export interface ComplexGroup {
  key: string;
  complexName: string;
  primary: Property;
  siblings: Property[];
}

export function stripUnitSuffix(addr: string): string {
  return (addr ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function complexGroupKey(p: Property): string {
  const name = p.complex_name?.trim();
  if (name) return `c:${name.toLowerCase()}`;
  const base = stripUnitSuffix(p.address).toLowerCase();
  if (base) {
    const lat = Math.round(p.latitude * 1e4) / 1e4;
    const lng = Math.round(p.longitude * 1e4) / 1e4;
    return `a:${base}@${lat},${lng}`;
  }
  return `s:${p.id}`;
}

export function findSiblingProperties(
  target: Property,
  all: Property[],
): Property[] {
  const key = complexGroupKey(target);
  return all.filter((other) => other.id !== target.id && complexGroupKey(other) === key);
}

export function findExistingMatch(
  candidate: { address: string; latitude: number; longitude: number },
  all: Property[],
): Property | null {
  const base = stripUnitSuffix(candidate.address).toLowerCase();
  if (!base) return null;
  for (const p of all) {
    if (stripUnitSuffix(p.address).toLowerCase() !== base) continue;
    if (Math.abs(p.latitude - candidate.latitude) > 0.0005) continue;
    if (Math.abs(p.longitude - candidate.longitude) > 0.0005) continue;
    return p;
  }
  return null;
}

export function groupByComplexInOrder(properties: Property[]): ComplexGroup[] {
  const byKey = new Map<string, Property[]>();
  const order: string[] = [];
  for (const p of properties) {
    const key = complexGroupKey(p);
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(p);
  }
  return order.map((key) => {
    const list = byKey.get(key)!;
    return {
      key,
      complexName: list[0].complex_name?.trim() ?? "",
      primary: list[0],
      siblings: list.slice(1),
    };
  });
}

export function dedupeByComplex(
  properties: Property[],
  rank: (p: Property) => number,
): Property[] {
  const byKey = new Map<string, Property>();
  for (const p of properties) {
    const key = complexGroupKey(p);
    const existing = byKey.get(key);
    if (!existing || rank(p) < rank(existing)) {
      byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

export function formatAvailability(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function isAvailabilityPast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

export function hasInUnitLaundry(pros: string[]): boolean {
  const text = pros.join(" | ").toLowerCase();
  if (!text) return false;
  if (/\b(shared|common|building|coin[-\s]?op)\s+(laundry|washer)/.test(text)) {
    return false;
  }
  if (/\bhookups?\s+only\b/.test(text)) return false;
  if (/\bno\s+(in[-\s]?unit\s+)?(washer|laundry|w\s*\/\s*d)\b/.test(text)) {
    return false;
  }
  if (/\bin[-\s]?unit\b/.test(text) && /(washer|dryer|laundry|w\s*\/\s*d)/.test(text)) {
    return true;
  }
  if (/\b(washer\s*\/\s*dryer|w\s*\/\s*d)\b/.test(text)) return true;
  return false;
}
