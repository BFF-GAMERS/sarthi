/**
 * The live translator: swaps the English on a page for the chosen language.
 *
 * Text nodes and a few attributes are rewritten in place, after React has rendered. React only
 * writes a text node when its value changes, so a translated node is left alone until there is new
 * English, which the observer then picks up. Every original is kept, so choosing English again
 * restores the page exactly.
 *
 * Skipped: code (it would stop being code), form values, anything under translate="no", and the
 * private pages listed in text.ts. Text is written back with `.data` and `setAttribute`, never as
 * markup, so nothing a translation contains can run.
 */
import { batches, isPrivatePath, shouldTranslate, withSameSpacing } from "./text";

const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "KBD"]);
const STORE_LIMIT = 6000;
const CONCURRENT = 3;
const MAX_TRIES = 3;

type Shown = { orig: string; shown: string };

export function startTranslator(lang: string): () => void {
  const key = `swayam.tr.${lang}`;
  const known = new Map<string, string>();
  try {
    for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(key) ?? "{}"))) {
      known.set(k, String(v));
    }
  } catch {
    /* storage blocked or corrupt: start empty */
  }

  const texts = new Map<Text, Shown>();
  const attrs = new Map<Element, Map<string, Shown>>();
  const wanted = new Set<string>();
  const failed = new Set<string>();
  const inflight = new Set<string>();
  const tries = new Map<string, number>();
  let stopped = false;
  let flushing = false;
  let timer = 0;
  let pausedUntil = 0;

  const skip = (el: Element | null) =>
    !el ||
    SKIP_TAGS.has(el.tagName.toUpperCase()) ||
    Boolean(el.closest('[translate="no"],code,pre'));

  const visitText = (node: Text) => {
    const seen = texts.get(node);
    if (seen && node.data === seen.shown) return;
    const orig = node.data;
    const k = orig.trim();
    if (!shouldTranslate(k)) return;
    const hit = known.get(k);
    if (hit) {
      const shown = withSameSpacing(orig, hit);
      texts.set(node, { orig, shown });
      node.data = shown;
    } else if (!failed.has(k) && !inflight.has(k)) {
      wanted.add(k);
    }
  };

  const visitAttrs = (el: Element) => {
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      if (!value) continue;
      const seen = attrs.get(el)?.get(name);
      if (seen && value === seen.shown) continue;
      const k = value.trim();
      if (!shouldTranslate(k)) continue;
      const hit = known.get(k);
      if (hit) {
        if (!attrs.has(el)) attrs.set(el, new Map());
        attrs.get(el)!.set(name, { orig: value, shown: hit });
        el.setAttribute(name, hit);
      } else if (!failed.has(k) && !inflight.has(k)) {
        wanted.add(k);
      }
    }
  };

  const scan = () => {
    if (stopped || isPrivatePath(location.pathname)) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            return skip(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) visitText(n as Text);
      else visitAttrs(n as Element);
    }
    void flush();
  };

  const schedule = (ms = 300) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(scan, ms);
  };

  const remember = () => {
    try {
      const entries = [...known].slice(-STORE_LIMIT);
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota or blocked: this session still has them */
    }
  };

  const sendGroup = async (group: string[]): Promise<void> => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang, texts: group }),
    });
    const body = res.ok
      ? ((await res.json()) as { translations?: (string | null)[]; retryAfter?: number })
      : {};
    group.forEach((t, i) => {
      const v = body.translations?.[i];
      if (v) known.set(t, v);
      else {
        // One bad batch must not leave its strings in English for good.
        const n = (tries.get(t) ?? 0) + 1;
        tries.set(t, n);
        if (n >= MAX_TRIES) failed.add(t);
      }
    });
    if (body.retryAfter) pausedUntil = Date.now() + body.retryAfter * 1000;
  };

  const flush = async () => {
    if (flushing || stopped || wanted.size === 0) return;
    if (Date.now() < pausedUntil || !navigator.onLine) return;
    flushing = true;
    const groups = batches([...wanted], 12, 1800);
    wanted.forEach((t) => inflight.add(t));
    wanted.clear();
    const worker = async () => {
      for (let g = groups.shift(); g; g = groups.shift()) {
        if (stopped || Date.now() < pausedUntil) break;
        try {
          await sendGroup(g);
        } catch {
          break; // offline or the request died: the next change tries again
        }
        g.forEach((t) => inflight.delete(t));
        if (!stopped) scan();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENT }, worker));
    inflight.clear();
    flushing = false;
    remember();
    if (stopped) return;
    const wait = Math.max(pausedUntil - Date.now(), 0);
    schedule(wait + 400); // whatever is still English gets another pass
  };

  const observer = new MutationObserver(() => schedule());
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });

  // Ready-made tables for the main pages, when this language has one.
  fetch(`/i18n/${lang}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((table: Record<string, string> | null) => {
      if (table) for (const [k, v] of Object.entries(table)) if (!known.has(k)) known.set(k, v);
    })
    .catch(() => {})
    .finally(() => schedule(0));

  return () => {
    stopped = true;
    observer.disconnect();
    window.clearTimeout(timer);
    for (const [node, s] of texts) if (node.data === s.shown) node.data = s.orig;
    for (const [el, map] of attrs) {
      for (const [name, s] of map)
        if (el.getAttribute(name) === s.shown) el.setAttribute(name, s.orig);
    }
  };
}
