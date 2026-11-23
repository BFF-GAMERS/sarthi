import type { StorageAdapter } from "./adapter";

/** Fallback when localStorage is blocked, and the preview sandbox's store. */
export function createMemoryAdapter(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    kind: "memory",
    durable: false,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: (prefix) => [...map.keys()].filter((k) => k.startsWith(prefix)),
  };
}
