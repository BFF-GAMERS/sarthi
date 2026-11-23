const NS = "swyam.";

export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(NS + key);
  } catch {
    /* storage unavailable */
  }
}
