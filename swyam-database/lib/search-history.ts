import { useSyncExternalStore } from "react";

/**
 * What this person searched for last.
 *
 * Kept on the device, because a search is a half-formed thought rather than a
 * record — and because a shared computer at a training centre should not hand
 * the next person a list of what the last one was looking for on their
 * account. Five entries, most recent first, and clearable.
 */

const KEY = "swayam-recent-searches";
const MAX = 5;

const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

function read(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try {
    localStorage?.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* private window: searches simply are not remembered */
  }
  bump();
}

export function rememberSearch(term: string): void {
  const t = term.trim();
  // Two characters is a typo, not a search.
  if (t.length < 3) return;
  const list = read().filter((x) => x.toLowerCase() !== t.toLowerCase());
  write([t, ...list]);
}

export function forgetSearch(term: string): void {
  write(read().filter((x) => x !== term));
}

export function clearSearches(): void {
  write([]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  if (typeof window !== "undefined") window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", l);
  };
};

let cache: string[] = [];
let cacheKey = "";
function snapshot(): string[] {
  const list = read();
  const k = list.join("|");
  if (k !== cacheKey) {
    cache = list;
    cacheKey = k;
  }
  return cache;
}
const EMPTY: string[] = [];

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
