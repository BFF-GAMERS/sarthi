/**
 * Local tab-usage counts (lane B2). Counts per page, per tab, per day number; nothing else.
 * Pure: the caller passes the day number and does the storage. Everything read back is sanitised, because
 * localStorage is user-editable and an old build may have written anything.
 */

/** tabId -> day number -> number of times the member picked it that day. */
export type PageUsage = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface TabStore {
  v: 1;
  /** pageId -> usage */
  u: Readonly<Record<string, PageUsage>>;
  /** pageId -> the order last shown (tab ids), so the next change moves at most two tabs. */
  o: Readonly<Record<string, readonly string[]>>;
}

export const TAB_STORE_KEY = "swayam.tabs.v1";
export const USAGE_WINDOW_DAYS = 14;

const MAX_PAGES = 8;
const MAX_TABS = 16;
const MAX_ID = 40;
const MAX_COUNT = 999;

export const emptyStore = (): TabStore => ({ v: 1, u: {}, o: {} });

const isRec = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Tolerant parse: anything unreadable becomes an empty store. */
export function parseTabStore(raw: string | null | undefined): TabStore {
  if (!raw) return emptyStore();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return emptyStore();
  }
  if (!isRec(j) || j["v"] !== 1) return emptyStore();
  const u: Record<string, PageUsage> = {};
  const o: Record<string, string[]> = {};
  const rawU = isRec(j["u"]) ? j["u"] : {};
  for (const page of Object.keys(rawU).slice(0, MAX_PAGES)) {
    const tabs = rawU[page];
    if (!isRec(tabs)) continue;
    const pageUsage: Record<string, Record<string, number>> = {};
    for (const tab of Object.keys(tabs).slice(0, MAX_TABS)) {
      const days = tabs[tab];
      if (!isRec(days) || tab.length > MAX_ID) continue;
      const clean: Record<string, number> = {};
      for (const d of Object.keys(days).slice(0, USAGE_WINDOW_DAYS * 2)) {
        const n = days[d];
        if (/^\d{1,7}$/.test(d) && typeof n === "number" && Number.isFinite(n) && n > 0) {
          clean[d] = Math.min(MAX_COUNT, Math.floor(n));
        }
      }
      if (Object.keys(clean).length > 0) pageUsage[tab] = clean;
    }
    u[page] = pageUsage;
  }
  const rawO = isRec(j["o"]) ? j["o"] : {};
  for (const page of Object.keys(rawO).slice(0, MAX_PAGES)) {
    const ids = rawO[page];
    if (Array.isArray(ids)) {
      o[page] = ids
        .filter((x): x is string => typeof x === "string" && x.length <= MAX_ID)
        .slice(0, MAX_TABS);
    }
  }
  return { v: 1, u, o };
}

/** One more pick of `tabId` on `page`, on day `today`. Days older than the window are dropped. */
export function bumpUsage(store: TabStore, page: string, tabId: string, today: number): TabStore {
  const pageUsage: Record<string, Record<string, number>> = {};
  for (const [tab, days] of Object.entries(store.u[page] ?? {})) {
    const kept: Record<string, number> = {};
    for (const [d, n] of Object.entries(days)) {
      if (today - Number(d) < USAGE_WINDOW_DAYS) kept[d] = n;
    }
    if (Object.keys(kept).length > 0) pageUsage[tab] = kept;
  }
  const mine = { ...(pageUsage[tabId] ?? {}) };
  mine[String(today)] = Math.min(MAX_COUNT, (mine[String(today)] ?? 0) + 1);
  pageUsage[tabId] = mine;
  return { ...store, u: { ...store.u, [page]: pageUsage } };
}

/** Remember the order just shown for `page`. */
export function withShownOrder(store: TabStore, page: string, order: readonly string[]): TabStore {
  return { ...store, o: { ...store.o, [page]: [...order] } };
}
