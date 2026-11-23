/**
 * The storage seam. Synchronous on purpose: zustand persist then hydrates at creation, so no write can
 * happen before the read. Every evolution key lives under `swayam.evo.`; other swayam-* keys are never touched.
 */
export const EVO_PREFIX = "swayam.evo.";

export interface StorageAdapter {
  readonly kind: "local" | "memory" | "null";
  /** false means "this window only" (memory fallback or server). */
  readonly durable: boolean;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(prefix: string): string[];
  /** Changes made elsewhere (another tab). key === null means everything was cleared. */
  subscribe?(listener: (key: string | null) => void): () => void;
}

export const isEvoKey = (k: unknown): k is string =>
  typeof k === "string" && k.startsWith(EVO_PREFIX);
