/**
 * Initials avatars, generated locally as SVG data URIs.
 *
 * Replaces third-party random-face services, which returned stock portraits of
 * people unrelated to (and unrepresentative of) this platform's users. Deriving
 * the mark from the person's own name is accurate, loads instantly, never 404s
 * and works offline.
 */

/**
 * Returned by a function rather than held in a module constant.
 *
 * `data/mock.ts` calls `initialsAvatar()` sixty-eight times at module scope,
 * and the bundler puts that data and this file in different chunks. When the
 * data chunk happened to evaluate first, `PALETTE` was still uninitialised —
 * so the failure was not "wrong colour", it was
 *
 *     TypeError: Cannot read properties of undefined (reading 'length')
 *
 * at module-load time, which returns 500 for every route on the site before a
 * single component renders. It surfaced twice, both times triggered by an
 * unrelated import being added somewhere else and shifting the chunk order —
 * a clean typecheck and a clean build say nothing about it.
 *
 * A function body is evaluated when it is called, so this cannot be read
 * before it exists no matter how the graph is arranged.
 */
function palette(): ReadonlyArray<readonly [string, string]> {
  return [
    ["#F5723F", "#C9330A"],
    ["#16213E", "#0F172A"],
    ["#1F5C3D", "#103A25"],
    ["#7C3AED", "#4C1D95"],
    ["#0E7490", "#155E75"],
    ["#B45309", "#78350F"],
  ];
}

function initialsOf(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, "")
    .replace(/\b(dr|mr|mrs|ms|sister|inspector|retd)\.?\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic avatar for a person's name, as an inline SVG data URI. */
export function initialsAvatar(name: string): string {
  // Tolerate a missing name rather than throwing at module scope: this is
  // called while data files initialise, where a throw takes the whole page.
  const safe = typeof name === "string" && name.trim() ? name : "?";
  const initials = initialsOf(safe);
  const colours = palette();
  const [from, to] = colours[hash(safe) % colours.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><text x="64" y="64" dy="0.35em" text-anchor="middle" font-family="Space Grotesk, Segoe UI, system-ui, sans-serif" font-size="52" font-weight="600" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
