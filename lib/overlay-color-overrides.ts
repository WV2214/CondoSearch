const STORAGE_KEY = "overlay-color-overrides";
const EVENT_NAME = "overlay-color-overrides:changed";

type Overrides = Record<string, string>;

function read(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Overrides) : {};
  } catch {
    return {};
  }
}

function write(next: Overrides) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / privacy-mode errors
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function loadOverrides(): Overrides {
  return read();
}

export function getOverride(propertyId: string): string | null {
  return read()[propertyId] ?? null;
}

export function setOverride(propertyId: string, hex: string) {
  const next = read();
  next[propertyId] = hex;
  write(next);
}

export function clearOverride(propertyId: string) {
  const next = read();
  if (!(propertyId in next)) return;
  delete next[propertyId];
  write(next);
}

export function subscribeOverrides(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
