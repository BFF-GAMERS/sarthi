/**
 * "Where was I?" for the four lists: jobs, internships, courses, skills.
 *
 * Opening a card and pressing Back used to drop you at the top of the list,
 * with the card you had just read somewhere in the next four hundred pixels.
 * The router's own scroll restoration is off on purpose (it made freshly
 * opened pages start halfway down), so the lists remember for themselves:
 * when a card's link is used, the list, the card and the scroll offset are
 * written to sessionStorage; when that list is next reached by going BACK (or
 * by a link from the page that card opened), the offset is restored and the
 * card is marked "You were here".
 *
 * A plain navigation to the list (the nav bar, a fresh visit) is not a
 * return: it starts at the top and the old entry is discarded.
 *
 * Pure and storage-injectable so it can be tested without a browser.
 */

export type ListKey = "jobs" | "internships" | "courses" | "skills";

export interface ReturnEntry {
  listKey: ListKey;
  id: string;
  scrollY: number;
  ts: number;
  /** The path the card opened, so a "back to the list" link counts as a return. */
  href?: string;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "swayam-list-return";
/** An entry older than this is somebody else's session. */
const MAX_AGE_MS = 30 * 60_000;
/** A popstate this recent means the list was reached by Back / Forward. */
const POP_WINDOW_MS = 3000;

export const LIST_PATHS: Record<string, ListKey> = {
  "/jobs": "jobs",
  "/internships": "internships",
  "/courses": "courses",
  "/skills": "skills",
};

export function listKeyForPath(pathname: string | null | undefined): ListKey | null {
  if (!pathname) return null;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return LIST_PATHS[clean] ?? null;
}

function session(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function readAll(store: Store | null): Partial<Record<ListKey, ReturnEntry>> {
  if (!store) return {};
  try {
    const raw = store.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Partial<Record<ListKey, ReturnEntry>>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(store: Store | null, all: Partial<Record<ListKey, ReturnEntry>>) {
  if (!store) return;
  try {
    if (Object.keys(all).length) store.setItem(KEY, JSON.stringify(all));
    else store.removeItem(KEY);
  } catch {
    /* Private window or storage full: the list simply starts at the top. */
  }
}

export function saveReturn(entry: ReturnEntry, store: Store | null = session()): void {
  const all = readAll(store);
  all[entry.listKey] = entry;
  writeAll(store, all);
}

export function readReturn(
  listKey: ListKey,
  now = Date.now(),
  store: Store | null = session(),
): ReturnEntry | null {
  const e = readAll(store)[listKey];
  if (!e || typeof e.id !== "string" || !Number.isFinite(e.scrollY)) return null;
  if (now - e.ts > MAX_AGE_MS || e.ts > now + 60_000) return null;
  return e;
}

export function clearReturn(listKey: ListKey, store: Store | null = session()): void {
  const all = readAll(store);
  if (!all[listKey]) return;
  delete all[listKey];
  writeAll(store, all);
}

/* ── how did we get here? ────────────────────────────────────────── */

const nav = { path: null as string | null, prev: null as string | null, popAt: 0, seq: 0 };
let decided: { seq: number; key: ListKey; entry: ReturnEntry | null } | null = null;

/** Called when the browser's Back / Forward fires. */
export function notePop(now = Date.now()): void {
  nav.popAt = now;
}

/** Called once per route change (ScrollToTop does it). */
export function noteNavigation(pathname: string): void {
  if (nav.path === pathname) return;
  nav.prev = nav.path;
  nav.path = pathname;
  nav.seq += 1;
}

/** Tests only. */
export function resetNavigationForTests(): void {
  nav.path = null;
  nav.prev = null;
  nav.popAt = 0;
  nav.seq = 0;
  decided = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => notePop());
}

/**
 * The saved entry if reaching `listKey` right now is a return to it, else null
 * (and the stale entry is dropped). The answer is remembered for the whole
 * navigation, so ScrollToTop and the list agree whichever of them asks first.
 */
export function returnFor(
  listKey: ListKey,
  now = Date.now(),
  store: Store | null = session(),
): ReturnEntry | null {
  if (decided && decided.seq === nav.seq && decided.key === listKey) return decided.entry;

  const entry = readReturn(listKey, now, store);
  const popped = now - nav.popAt < POP_WINDOW_MS;
  const fromItsPage = Boolean(entry?.href && nav.prev && samePath(entry.href, nav.prev));
  const result = entry && (popped || fromItsPage) ? entry : null;
  if (entry && !result) clearReturn(listKey, store);
  decided = { seq: nav.seq, key: listKey, entry: result };
  return result;
}

function samePath(a: string, b: string): boolean {
  const strip = (s: string) => s.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return strip(a) === strip(b);
}

/* ── reading a click ─────────────────────────────────────────────── */

interface ElementLike {
  closest?: (selector: string) => ElementLike | null;
  getAttribute?: (name: string) => string | null;
}

/** The id of the card a link sits in, or null. */
export function returnIdOf(target: unknown): { id: string; href: string | undefined } | null {
  const el = target as ElementLike | null;
  if (!el || typeof el.closest !== "function") return null;
  const link = el.closest("a[href]");
  if (!link) return null;
  const card = link.closest?.("[data-return-id]");
  const id = card?.getAttribute?.("data-return-id");
  if (!id) return null;
  return { id, href: link.getAttribute?.("href") ?? undefined };
}
