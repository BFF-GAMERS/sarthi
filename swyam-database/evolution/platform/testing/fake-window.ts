// Test-only fakes for the node Vitest environment: a Map-backed Storage with failure switches, a window that
// dispatches `storage` events between "tabs", and a minimal element tree with closest()/getAttribute().
// Never imported by app code.

export interface FakeStorageOptions {
  /** every call throws (blocked storage / SecurityError) */
  throwAll?: boolean;
  /** setItem throws a non-quota error (Safari private mode) */
  throwOnSet?: boolean;
  /** total characters allowed before setItem throws QuotaExceededError */
  quotaChars?: number;
}

export class FakeStorage implements Storage {
  readonly map = new Map<string, string>();
  reads = 0;
  writes = 0;
  constructor(public opts: FakeStorageOptions = {}) {}
  get length(): number {
    if (this.opts.throwAll) throw new Error("SecurityError");
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    if (this.opts.throwAll) throw new Error("SecurityError");
    this.reads++;
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.opts.throwAll || this.opts.throwOnSet) throw new Error("SecurityError");
    if (this.opts.quotaChars !== undefined) {
      let used = 0;
      for (const [kk, vv] of this.map) if (kk !== k) used += vv.length;
      if (used + v.length > this.opts.quotaChars) {
        const e = new Error("quota") as Error & { name: string };
        e.name = "QuotaExceededError";
        throw e;
      }
    }
    this.writes++;
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    if (this.opts.throwAll) throw new Error("SecurityError");
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

type Listener = (e: unknown) => void;

export interface FakeWindow {
  localStorage: FakeStorage;
  addEventListener(type: string, l: Listener): void;
  removeEventListener(type: string, l: Listener): void;
  dispatch(type: string, e: unknown): void;
  listenerCount(type: string): number;
}

export function createFakeWindow(storage: FakeStorage = new FakeStorage()): FakeWindow {
  const listeners = new Map<string, Set<Listener>>();
  return {
    localStorage: storage,
    addEventListener(type, l) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(l);
    },
    removeEventListener(type, l) {
      listeners.get(type)?.delete(l);
    },
    dispatch(type, e) {
      for (const l of listeners.get(type) ?? []) l(e);
    },
    listenerCount: (type) => listeners.get(type)?.size ?? 0,
  };
}

// ─── minimal DOM elements for the delegated listener ───────────────────────────────────────────────────

export class FakeElement {
  constructor(
    public attrs: Record<string, string> = {},
    public parent: FakeElement | null = null,
  ) {}
  getAttribute(name: string): string | null {
    return Object.hasOwn(this.attrs, name) ? (this.attrs[name] ?? null) : null;
  }
  hasAttribute(name: string): boolean {
    return Object.hasOwn(this.attrs, name);
  }
  matchesSelector(sel: string): boolean {
    const m = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) return false;
    const name = m[1] ?? "";
    const v = this.getAttribute(name);
    return m[2] === undefined ? v !== null : v === m[2];
  }
  closest(sel: string): FakeElement | null {
    return this.matchesSelector(sel) ? this : (this.parent?.closest(sel) ?? null);
  }
  child(attrs: Record<string, string> = {}): FakeElement {
    return new FakeElement(attrs, this);
  }
}
