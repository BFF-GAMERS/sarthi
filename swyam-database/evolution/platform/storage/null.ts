import type { StorageAdapter } from "./adapter";

/** Server adapter: reads nothing, writes nothing (SSR never persists). */
export function createNullAdapter(): StorageAdapter {
  return {
    kind: "null",
    durable: false,
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    keys: () => [],
  };
}
