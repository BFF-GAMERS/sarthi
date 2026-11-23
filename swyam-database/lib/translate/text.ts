/**
 * What the live translator will and will not send, as plain functions so they can be tested.
 */

/** Pages that hold a member's private words. Their text never leaves for translation. */
const PRIVATE_PATHS = [/^\/messages/, /^\/notifications/, /^\/admin/];

export const isPrivatePath = (path: string): boolean => PRIVATE_PATHS.some((p) => p.test(path));

/** Names that stay as they are, on their own or as a whole label. */
const NAMES = /^(swayam|sarthi|skillswap|gen z|millennial)$/i;

/** True when a piece of page text is English worth translating. */
export function shouldTranslate(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 1200) return false;
  if (NAMES.test(s) || s.includes("@") || /^https?:|^www\.|^\/[a-z]/i.test(s)) return false;
  // Serials, codes and figures: "SWY-24-0417", "₹2,999", "12 / 40".
  if (/^[A-Z0-9\-_/.:₹,%\s]+$/.test(s) && !/[A-Z][a-z]/.test(s) && s.length < 16) return false;
  const latin = s.match(/[A-Za-z]/g)?.length ?? 0;
  // Already in another script (a tx() string, a name in Hindi): leave it.
  return latin >= 2 && latin >= s.replace(/[\s\d\p{P}\p{S}]/gu, "").length * 0.5;
}

/** Keeps the spaces around a piece of text, which carry the layout between inline elements. */
export function withSameSpacing(original: string, translated: string): string {
  const lead = /^\s*/.exec(original)?.[0] ?? "";
  const trail = /\s*$/.exec(original)?.[0] ?? "";
  return lead + translated.trim() + trail;
}

/** Splits strings into requests the server will accept. */
export function batches(texts: string[], maxItems = 25, maxChars = 5000): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (cur.length && (cur.length >= maxItems || size + t.length > maxChars)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}
