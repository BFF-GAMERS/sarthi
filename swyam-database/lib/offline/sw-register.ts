/**
 * Registering the offline service worker (public/sw.js).
 *
 * Only ever called from an effect after hydration, so the server render and the
 * first client render are untouched. Feature-detected and wrapped: a browser
 * without service workers simply has no offline page cache, and the downloaded
 * lesson text is still readable wherever the page itself loads.
 *
 * The worker's scope is /learn/. It cannot see the home page, /auth, the API or
 * anything cross-origin; see the header of public/sw.js for the full list.
 */

export const SW_URL = "/sw.js";
export const SW_SCOPE = "/learn/";
/** Keep in step with CACHE_PREFIX / CACHE_VERSION in public/sw.js. */
export const CACHE_PREFIX = "swayam-offline-";
export const CACHE_NAME = `${CACHE_PREFIX}v1`;
/** A page's scripts and styles: bounded so one lesson cannot fill the cache. */
export const MAX_PRECACHE_ASSETS = 40;

/** https, or a local development host. (Service workers refuse anything else.) */
export function isSecureOrigin(protocol: string, hostname: string): boolean {
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function canUseServiceWorker(): boolean {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    return isSecureOrigin(window.location.protocol, window.location.hostname);
  } catch {
    return false;
  }
}

let registering: Promise<boolean> | null = null;

/** Idempotent. Resolves true once registered, false on any failure. */
export function registerOfflineSw(): Promise<boolean> {
  if (registering) return registering;
  if (!canUseServiceWorker()) return Promise.resolve(false);
  registering = navigator.serviceWorker
    .register(SW_URL, { scope: SW_SCOPE })
    .then(() => true)
    .catch(() => {
      registering = null;
      return false;
    });
  return registering;
}

/**
 * The way out: unregister the worker and delete everything it cached. Used when
 * the learner deletes their last download, so nothing lingers.
 */
export async function unregisterOfflineSw(): Promise<void> {
  registering = null;
  try {
    if (canUseServiceWorker()) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter((r) => r.scope.endsWith(SW_SCOPE)).map((r) => r.unregister()));
    }
  } catch {
    /* nothing to undo */
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)),
      );
    }
  } catch {
    /* nothing to undo */
  }
}

/** Same-origin /assets/*.js and *.css that an HTML page asks for. Pure. */
export function extractAssetUrls(html: string, limit = MAX_PRECACHE_ASSETS): string[] {
  const found = new Set<string>();
  const re = /(?:src|href)=["'](\/assets\/[^"'?#\s]+\.(?:js|css))["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && found.size < limit) found.add(m[1]!);
  return [...found];
}

function okToStore(res: Response): boolean {
  if (!res.ok || res.type !== "basic") return false;
  return !/no-store|private/i.test(res.headers.get("cache-control") ?? "");
}

/**
 * Put a lesson page and the scripts and styles it needs into the worker's
 * cache, right after a download. The route's code is split into chunks the
 * course page never loaded, so without this the page would open offline as a
 * blank shell. Best effort: returns how many entries it stored.
 */
export async function precacheLearnPage(courseSlug: string, signal?: AbortSignal): Promise<number> {
  try {
    if (!canUseServiceWorker() || typeof caches === "undefined") return 0;
    const cache = await caches.open(CACHE_NAME);
    const path = `/learn/${encodeURIComponent(courseSlug)}`;
    const page = await fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      ...(signal ? { signal } : {}),
    });
    if (!okToStore(page)) return 0;
    const html = await page.clone().text();
    await cache.put(`${window.location.origin}${path}`, page);
    let stored = 1;

    // What this page has already loaded is also needed to render the next one.
    const loaded = new Set<string>();
    document
      .querySelectorAll<HTMLElement>(
        'script[src], link[rel="stylesheet"], link[rel="modulepreload"]',
      )
      .forEach((el) => {
        const raw = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
        try {
          const u = new URL(raw, window.location.origin);
          if (u.origin === window.location.origin && /^\/assets\/.+\.(js|css)$/.test(u.pathname)) {
            loaded.add(u.pathname);
          }
        } catch {
          /* ignore a malformed URL */
        }
      });
    const wanted = [...new Set([...extractAssetUrls(html), ...loaded])].slice(
      0,
      MAX_PRECACHE_ASSETS,
    );

    for (const asset of wanted) {
      if (signal?.aborted) break;
      const key = `${window.location.origin}${asset}`;
      if (await cache.match(key)) continue;
      try {
        const res = await fetch(asset, {
          credentials: "same-origin",
          ...(signal ? { signal } : {}),
        });
        if (okToStore(res)) {
          await cache.put(key, res);
          stored += 1;
        }
      } catch {
        /* one missing asset must not fail the rest */
      }
    }
    return stored;
  } catch {
    return 0;
  }
}
