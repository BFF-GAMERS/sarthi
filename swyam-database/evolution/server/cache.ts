/**
 * A small in-memory LRU with a TTL (plan §5.3: 200 entries, 24 h).
 *
 * A hit costs no Gemini quota and no rate-limit budget, which is what makes
 * the Lab's persona demos (fixed summaries) free after the first run. It lives
 * in one server instance's memory, like rate-limit.ts: it saves money, it is
 * not a source of truth, and a cold instance simply starts empty.
 */
export class LruCache<V> {
  private readonly map = new Map<string, { value: V; at: number }>();

  constructor(
    private readonly max = 200,
    private readonly ttlMs = 24 * 60 * 60_000,
  ) {}

  get(key: string, now: number): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert so the Map's iteration order is least- to most-recently used.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, now: number): void {
    this.map.delete(key);
    this.map.set(key, { value, at: now });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
