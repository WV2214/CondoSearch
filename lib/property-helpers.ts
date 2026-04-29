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
