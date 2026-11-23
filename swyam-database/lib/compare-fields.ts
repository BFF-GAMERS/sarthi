import type { Course } from "../data/mock";
import { payLine, type Opportunity } from "./opportunities";

/**
 * What the compare table says, and how a comparison travels in a link.
 *
 * Pure on purpose: no React, no storage, no clock unless one is passed in.
 * The table is the last place to start guessing, so every row here is a fact
 * the listing already carries, "Not stated" where it does not, and a "best"
 * hint only where two numbers are objectively comparable (a lower fee, a
 * higher pay in the same period) — never a verdict on which one to pick.
 */

/* ── kinds, groups, ids ─────────────────────────────────────────────── */

export const COMPARE_KINDS = ["job", "internship", "course"] as const;
export type CompareKind = (typeof COMPARE_KINDS)[number];
/** Jobs and internships compare together; courses only with courses. */
export type CompareGroup = "opportunity" | "course";

export const COMPARE_MIN = 2;
export const COMPARE_LIMIT = 3;
export const COMPARE_ID_MAX_LEN = 80;
const ID_RE = /^[a-z0-9:_-]+$/;

export const isCompareKind = (v: unknown): v is CompareKind =>
  typeof v === "string" && (COMPARE_KINDS as readonly string[]).includes(v);

export const groupOf = (kind: CompareKind): CompareGroup =>
  kind === "course" ? "course" : "opportunity";

export const otherGroup = (g: CompareGroup): CompareGroup =>
  g === "course" ? "opportunity" : "course";

export const isValidCompareId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= COMPARE_ID_MAX_LEN && ID_RE.test(v);

/* ── the link: /compare?kind=job|internship|course&ids=a,b,c ───────────── */

export type CompareParseFailure = "kind" | "ids" | "too-few" | "too-many";
export type CompareParse =
  { ok: true; kind: CompareKind; ids: string[] } | { ok: false; reason: CompareParseFailure };

/**
 * Read the two query values. Anything off — an unknown kind, an id with a
 * stray character or past 80 characters, more than three — rejects the lot
 * rather than quietly trimming it: a forwarded link that half works is worse
 * than one that says so. Duplicates collapse; empty pieces ("a,,b,") are
 * ignored. `min` is 2 for a real comparison and 1 for the route's lenient
 * read, so a link that has been removed down to one item still opens.
 */
export function parseCompareParams(
  input: { kind?: unknown; ids?: unknown },
  opts: { min?: number } = {},
): CompareParse {
  const min = opts.min ?? COMPARE_MIN;
  if (!isCompareKind(input.kind)) return { ok: false, reason: "kind" };

  // The router may hand a lone numeric-looking id back as a number.
  const raw = input.ids;
  const pieces: unknown[] = Array.isArray(raw)
    ? raw.flatMap((x) => (typeof x === "string" ? x.split(",") : [x]))
    : typeof raw === "string"
      ? raw.split(",")
      : typeof raw === "number"
        ? [String(raw)]
        : [];

  const ids: string[] = [];
  for (const piece of pieces) {
    const id =
      typeof piece === "number" ? String(piece) : typeof piece === "string" ? piece.trim() : null;
    if (id === null) return { ok: false, reason: "ids" };
    if (id === "") continue;
    if (!isValidCompareId(id)) return { ok: false, reason: "ids" };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > COMPARE_LIMIT) return { ok: false, reason: "too-many" };
  if (ids.length < min) return { ok: false, reason: "too-few" };
  return { ok: true, kind: input.kind, ids };
}

/** The route's `validateSearch`: valid params pass through, anything else is dropped. */
export function compareSearch(search: Record<string, unknown>): {
  kind?: CompareKind;
  ids?: string;
} {
  const p = parseCompareParams({ kind: search["kind"], ids: search["ids"] }, { min: 1 });
  return p.ok ? { kind: p.kind, ids: p.ids.join(",") } : {};
}

/** `/compare?kind=job&ids=a,b` — commas and colons left readable. */
export function compareHref(kind: CompareKind, ids: string[]): string {
  const list = ids.map((id) => encodeURIComponent(id).replace(/%3A/gi, ":")).join(",");
  return `/compare?kind=${kind}&ids=${list}`;
}

/* ── rows ───────────────────────────────────────────────────────────── */

type Tx = (english: string) => string;

export interface CompareColumn {
  id: string;
  kind: CompareKind;
  title: string;
  subtitle?: string;
}

export interface CompareRow {
  id: string;
  label: string;
  /** One value per column, in column order. */
  values: string[];
  /** The values are not identical across the columns. */
  differs: boolean;
  /** Column indexes that are best on an objective measure, with the words for it. */
  best?: number[];
  bestHint?: string;
  /** A single sentence across every column (skills in common). */
  span?: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const valuesDiffer = (values: string[]): boolean => new Set(values.map(norm)).size > 1;

const clip = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function row(
  id: string,
  label: string,
  values: string[],
  extra: { best?: number[]; bestHint?: string } = {},
): CompareRow {
  const differs = valuesDiffer(values);
  const out: CompareRow = { id, label, values, differs };
  if (differs && extra.best && extra.best.length > 0 && extra.best.length < values.length) {
    out.best = extra.best;
    if (extra.bestHint) out.bestHint = extra.bestHint;
  }
  return out;
}

/** Indexes holding the extreme of a fully-known list of numbers, or none when they are all equal. */
function extreme(nums: (number | null)[], mode: "max" | "min"): number[] {
  if (nums.length < 2 || nums.some((n) => n === null)) return [];
  const known = nums as number[];
  const target = mode === "max" ? Math.max(...known) : Math.min(...known);
  const idx = known.flatMap((n, i) => (n === target ? [i] : []));
  return idx.length === known.length ? [] : idx;
}

/** Drop a row that says nothing but "Not stated" — it is noise, not a comparison. */
const dropEmpty = (rows: CompareRow[], unknown: string) =>
  rows.filter((r) => r.span !== undefined || r.values.some((v) => v !== unknown && v !== "—"));

/* ── jobs and internships ─────────────────────────────────────────── */

const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

export function opportunityColumns(items: Opportunity[]): CompareColumn[] {
  return items.map((o) => ({
    id: o.slug,
    kind: o.kind,
    title: o.title,
    subtitle: o.employer?.name,
  }));
}

/** Pay as one comparable number, or null when it is unstated. Midpoint of a range. */
function payNumber(o: Opportunity): number | null {
  if (o.kind === "internship") return o.stipend && o.stipend > 0 ? o.stipend : null;
  if (o.salaryMin && o.salaryMax) return (o.salaryMin + o.salaryMax) / 2;
  return o.salaryMin ?? null;
}

const dayCount = (iso: string, now: number) =>
  Math.ceil((new Date(iso).getTime() - now) / 86_400_000);

export function opportunityRows(
  items: Opportunity[],
  tx: Tx,
  now: number = Date.now(),
): CompareRow[] {
  const unknown = tx("Not stated");
  const rows: CompareRow[] = [];

  rows.push(
    row(
      "type",
      tx("Type"),
      items.map((o) => (o.kind === "internship" ? tx("Internship") : tx("Job"))),
    ),
  );
  rows.push(
    row(
      "employer",
      tx("Employer"),
      items.map((o) => o.employer?.name ?? unknown),
    ),
  );
  rows.push(
    row(
      "location",
      tx("Location"),
      items.map((o) => o.location ?? o.region ?? unknown),
    ),
  );
  rows.push(
    row(
      "mode",
      tx("Work mode"),
      items.map((o) => tx(WORK_MODE[o.workMode] ?? o.workMode)),
    ),
  );

  // Pay is only ranked when every item states it in the same period; a
  // monthly stipend against a yearly package is not a comparison.
  const periodsAlike = new Set(items.map((o) => o.payPeriod)).size === 1;
  rows.push(
    row(
      "pay",
      tx("Pay"),
      items.map((o) => {
        const line = payLine(o);
        return line === null ? unknown : line === "Unpaid" ? tx("Unpaid") : line;
      }),
      periodsAlike
        ? { best: extreme(items.map(payNumber), "max"), bestHint: tx("Highest pay") }
        : {},
    ),
  );

  rows.push(
    row(
      "duration",
      tx("Duration"),
      items.map((o) =>
        o.durationWeeks
          ? `${o.durationWeeks} ${tx(o.durationWeeks === 1 ? "week" : "weeks")}`
          : unknown,
      ),
    ),
  );
  rows.push(
    row(
      "hours",
      tx("Hours per week"),
      items.map((o) => (o.hoursPerWeek ? `${o.hoursPerWeek} ${tx("hours")}` : unknown)),
    ),
  );
  rows.push(
    row(
      "experience",
      tx("Experience"),
      items.map((o) => o.details.experience?.trim() || unknown),
    ),
  );
  rows.push(
    row(
      "openings",
      tx("Openings"),
      items.map((o) => String(o.openings)),
      {
        best: extreme(
          items.map((o) => o.openings),
          "max",
        ),
        bestHint: tx("Most openings"),
      },
    ),
  );

  const left = items.map((o) => (o.deadline ? dayCount(o.deadline, now) : null));
  rows.push(
    row(
      "deadline",
      tx("Apply by"),
      items.map((o, i) => {
        if (!o.deadline) return tx("No deadline stated");
        const date = new Date(o.deadline).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const d = left[i] as number;
        if (d < 0) return `${date} (${tx("closed")})`;
        if (d === 0) return `${date} (${tx("today")})`;
        return `${date} (${d} ${tx(d === 1 ? "day left" : "days left")})`;
      }),
      { best: extreme(left, "max"), bestHint: tx("Most time to apply") },
    ),
  );

  rows.push(
    row(
      "skills",
      tx("Skills asked for"),
      items.map((o) => (o.skills.length ? o.skills.join(", ") : unknown)),
    ),
  );

  // What every listing asks for: the skills worth having whichever you pick.
  const lower = (s: string) => s.toLowerCase();
  const common = items[0]
    ? items[0].skills.filter((s) => items.every((o) => o.skills.some((x) => lower(x) === lower(s))))
    : [];
  if (items.some((o) => o.skills.length > 0)) {
    rows.push({
      id: "skills-common",
      label: tx("Skills in common"),
      values: items.map(() => ""),
      differs: false,
      span: common.length ? common.join(", ") : tx("None in common"),
    });
  }

  rows.push(
    row(
      "eligibility",
      tx("Who can apply"),
      items.map((o) => (o.eligibility?.trim() ? clip(o.eligibility.trim()) : unknown)),
    ),
  );

  return dropEmpty(rows, unknown);
}

/* ── courses ──────────────────────────────────────────────────────── */

/** The same facts the course page's "At a glance" prints, injected so this file stays light. */
export interface CourseFactHelpers {
  feeLine: (c: Course, tx: Tx) => string;
  startLine: (c: Course, tx: Tx) => string;
  hoursPerWeek: (c: Course) => number | null;
  orgName: (orgId: string) => string;
}

export const courseColumns = (items: Course[]): CompareColumn[] =>
  items.map((c) => ({ id: c.id, kind: "course", title: c.title, subtitle: c.category }));

/** The fee as a number: 0 for free, the first figure otherwise, null when it cannot be read. */
export function feeNumber(c: Pick<Course, "free" | "fees">): number | null {
  if (c.free || c.fees.startsWith("Free")) return 0;
  const m = /[\d,]+/.exec(c.fees);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function courseRows(items: Course[], tx: Tx, facts: CourseFactHelpers): CompareRow[] {
  return [
    row(
      "fee",
      tx("Fee"),
      items.map((c) => facts.feeLine(c, tx)),
      { best: extreme(items.map(feeNumber), "min"), bestHint: tx("Lowest fee") },
    ),
    row(
      "start",
      tx("Starts"),
      items.map((c) => facts.startLine(c, tx)),
    ),
    row(
      "duration",
      tx("Duration"),
      items.map((c) => c.duration),
    ),
    row(
      "hours",
      tx("Time per week"),
      items.map((c) => {
        const h = facts.hoursPerWeek(c);
        return h
          ? `~${h} ${tx("hours")}`
          : c.mode === "Online"
            ? tx("Your own pace")
            : tx("Ask the institute");
      }),
    ),
    row(
      "mode",
      tx("Mode"),
      items.map((c) => c.mode),
    ),
    row(
      "where",
      tx("Where"),
      items.map((c) => (c.mode === "Online" ? tx("Anywhere") : `${c.city}, ${c.state}`)),
    ),
    row(
      "level",
      tx("Level"),
      items.map((c) => c.difficulty),
    ),
    row(
      "before",
      tx("Before you start"),
      items.map((c) =>
        c.prerequisites?.length
          ? c.prerequisites.join(", ")
          : c.difficulty === "Beginner"
            ? tx("Nothing")
            : tx("Some background"),
      ),
    ),
    row(
      "cert",
      tx("Certificate from"),
      items.map((c) => facts.orgName(c.orgId)),
    ),
    row(
      "placement",
      tx("Placement support"),
      items.map((c) => (c.placementAssistance ? tx("Yes") : tx("No"))),
    ),
    row(
      "scholarship",
      tx("Scholarship"),
      items.map((c) => (c.scholarship ? tx("Available") : "—")),
    ),
    row(
      "teaches",
      tx("Teaches"),
      items.map((c) => c.outcomes.slice(0, 4).join("; ")),
    ),
  ];
}
