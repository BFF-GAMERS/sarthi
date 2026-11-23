/**
 * Pure helpers for sizes and storage quota. No browser APIs, so they run (and
 * are tested) anywhere.
 */

/** Bytes of a value once serialised, the way it will sit in IndexedDB as text. */
export function measureBytes(value: unknown): number {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return new TextEncoder().encode(text ?? "").length;
  } catch {
    return 0;
  }
}

/** "640 B", "180 KB", "1.4 MB". Never "0 KB" for something that has content. */
export function formatBytes(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (n < 1024) return `${Math.round(n)} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * "About 180 KB". A size shown before a download is an estimate, so it is
 * rounded the way a person would say it rather than to the byte.
 */
export function formatApprox(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const kb = n / 1024;
  if (kb >= 100 && kb < 1024) return `About ${Math.round(kb / 10) * 10} KB`;
  return `About ${formatBytes(n)}`;
}

export interface QuotaEstimate {
  usage: number;
  quota: number;
}

/** Share of the browser's allowance in use, clamped to 0..1; 0 when unknown. */
export function quotaFraction(usage: number, quota: number): number {
  if (!(quota > 0) || !(usage > 0)) return 0;
  return Math.min(1, usage / quota);
}

/**
 * Whether a download of `bytes` fits, with headroom: IndexedDB stores more than
 * the raw text, and a download that fails on the last module wastes the data
 * the learner spent. With no estimate available the answer is "try it".
 */
export function hasRoomFor(bytes: number, est: QuotaEstimate | null, headroom = 2): boolean {
  if (!est) return true;
  return est.quota - est.usage >= bytes * headroom;
}

/** Total bytes held by a list of packs. */
export function totalBytes(packs: ReadonlyArray<{ bytes: number }>): number {
  return packs.reduce((sum, p) => sum + (Number.isFinite(p.bytes) ? p.bytes : 0), 0);
}
