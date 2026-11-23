import type { Opportunity } from "./opportunities";
import type { Course } from "../data/mock";

/**
 * "Listing, decoded": a few plain-language lines about a job, internship or
 * course, each pinned to the words the listing itself used.
 *
 * Written by rules, not by a model. Every bullet is built from a field the
 * listing actually has, so the same listing always decodes the same way, there
 * is no network call, and a reader can compare each line with the quote under
 * it. Two promises hold for every bullet:
 *
 *  - `quote` is never reworded. It is a prefix of a sentence or line of the
 *    source, cut at a word boundary and marked with an ellipsis when cut.
 *    Where a fact only lives in a structured field (a stipend figure, a work
 *    mode) and the listing's prose does not repeat it, `quote` is the value as
 *    the listing's own facts show it, or null. It is never made up.
 *  - When the listing does not say, the bullet says so (`missing: true`).
 *    Nothing is guessed to fill a gap.
 *
 * Pure and SSR-safe: no I/O, no clock, no locale-dependent formatting, and the
 * input is never mutated. Type-only imports, so loading this pulls in nothing.
 */

export type DecodedKey = "do" | "pay" | "where" | "who" | "extra";

export interface DecodedBullet {
  key: DecodedKey;
  /** Short heading, English; translate at render time. */
  label: string;
  /** One plain sentence built by rule from the listing's fields. */
  text: string;
  /** Short verbatim source quote (ellipsis if cut), or null when none exists. */
  quote: string | null;
  /** True when the listing does not state this at all. */
  missing: boolean;
}

export const NOT_STATED = "Not stated in the listing";

const QUOTE_MAX = 90;

/* ── small pure helpers ─────────────────────────────────────────────────── */

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(clean).filter((s) => s.length > 0) : [];

/**
 * First line of `s`, cut to `max` characters at a word boundary with an
 * ellipsis. The result (minus the ellipsis) is always a prefix of the source.
 */
export function clipQuote(s: string, max: number = QUOTE_MAX): string {
  const line = (s ?? "").trim().split(/\r?\n/)[0].trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = (space >= 30 ? cut.slice(0, space) : cut).replace(/[\s,;:\-–—(]+$/, "");
  return `${base}…`;
}

/** The first sentence of the first line; the whole line if it is very short. */
function firstSentence(s: string): string {
  const line = s.trim().split(/\r?\n/)[0].trim();
  const m = /^.+?[.!?](?=\s|$)/.exec(line);
  return m && m[0].length >= 12 ? m[0].trim() : line;
}

/** First sentence or line, across the sources in order, that matches `re`. */
function snippet(sources: ReadonlyArray<string | null | undefined>, re: RegExp): string | null {
  for (const src of sources) {
    const s = clean(src);
    if (!s) continue;
    for (const seg of s.split(/\n+|(?<=[.!?])\s+/)) {
      if (re.test(seg)) return seg.trim();
    }
  }
  return null;
}

const sentence = (s: string): string => (/[.!?…]$/.test(s) ? s : `${s}.`);
const plural = (n: number, one: string, many: string = `${one}s`): string => (n === 1 ? one : many);

/** Rupees with Indian digit grouping, without leaning on the runtime's ICU data. */
function inr(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return `₹${s}`;
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${head},${s.slice(-3)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-05" or "2026-11-05T00:00:00Z" to "5 Nov 2026"; null if not a date. */
function dateLabel(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean(iso));
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${MONTHS[month - 1]} ${m[1]}`;
}

const LABEL = {
  do: "What you'll do",
  learn: "What you'll learn",
  pay: "Pay",
  fee: "Fee",
  where: "Where & when",
  who: "Who it's for",
  extra: "Also",
} as const;

const missing = (key: DecodedKey, label: string): DecodedBullet => ({
  key,
  label,
  text: NOT_STATED,
  quote: null,
  missing: true,
});

/* ── jobs and internships ───────────────────────────────────────────────── */

/** Same period wording the listing's own pay line uses (see payLine). */
const PERIOD_SPOKEN: Record<string, string> = {
  year: "a year",
  month: "a month",
  shift: "per shift",
  event: "per event",
  project: "per project",
};
const PERIOD_SUFFIX: Record<string, string> = {
  year: "/year",
  month: "/month",
  shift: " per shift",
  event: " per event",
  project: " per project",
};

/** A sentence that talks about pay at all. */
const PAY_WORD =
  /₹|\brs\.?\s*\d|\binr\b|\bstipend\b|\bsalary\b|\bctc\b|\blpa\b|\bincentive|\bunpaid\b|\bper (?:month|annum|year|hour|day|shift)\b/i;
/** A sentence that gives an actual money figure. */
const PAY_FIGURE =
  /₹\s*\d|\brs\.?\s*\d|\binr\s*\d|\b\d[\d,.]*\s*(?:lpa|ctc)\b|\bper (?:month|annum)\b/i;
const REMOTE_WORD = /\bremote\b|work from home|work-from-home|\bwfh\b/i;

function decodeDo(o: Opportunity): DecodedBullet {
  const tasks = cleanList(o.responsibilities);
  if (tasks.length > 0) {
    const more = tasks.length - 1;
    return {
      key: "do",
      label: LABEL.do,
      text: `Main task: ${clipQuote(tasks[0], 80)}${more > 0 ? ` (${more} more listed)` : ""}`,
      quote: clipQuote(tasks[0]),
      missing: false,
    };
  }
  const summary = clean(o.summary);
  if (summary) {
    const s = firstSentence(summary);
    return {
      key: "do",
      label: LABEL.do,
      text: `In short: ${clipQuote(s, 110)}`,
      quote: clipQuote(s),
      missing: false,
    };
  }
  const description = clean(o.description);
  if (description) {
    const s = firstSentence(description);
    return {
      key: "do",
      label: LABEL.do,
      text: `The description opens: ${clipQuote(s, 110)}`,
      quote: clipQuote(s),
      missing: false,
    };
  }
  return missing("do", LABEL.do);
}

function decodePay(o: Opportunity): DecodedBullet {
  const spoken = PERIOD_SPOKEN[o.payPeriod] ?? "a month";
  const suffix = PERIOD_SUFFIX[o.payPeriod] ?? "/month";
  const prose = [
    o.description,
    o.summary,
    o.eligibility,
    ...cleanList(o.responsibilities),
    ...cleanList(o.details?.benefits),
  ];
  const wordQuote = snippet(prose, PAY_WORD);
  const figureQuote = snippet(prose, PAY_FIGURE);

  const make = (text: string, display: string): DecodedBullet => ({
    key: "pay",
    label: LABEL.pay,
    text,
    quote: clipQuote(wordQuote ?? display),
    missing: false,
  });

  const stipend = typeof o.stipend === "number" && o.stipend > 0 ? o.stipend : null;
  const min = typeof o.salaryMin === "number" && o.salaryMin > 0 ? o.salaryMin : null;
  const max = typeof o.salaryMax === "number" && o.salaryMax > 0 ? o.salaryMax : null;

  if (o.kind === "internship" && stipend) {
    return make(`Pays a stipend of ${inr(stipend)} ${spoken}`, `${inr(stipend)}${suffix}`);
  }
  if (min && max) {
    return min === max
      ? make(`Pays ${inr(min)} ${spoken}`, `${inr(min)}${suffix}`)
      : make(`Pays ${inr(min)} to ${inr(max)} ${spoken}`, `${inr(min)} – ${inr(max)}${suffix}`);
  }
  if (min) return make(`Pays from ${inr(min)} ${spoken}`, `From ${inr(min)}${suffix}`);
  if (max) return make(`Pays up to ${inr(max)} ${spoken}`, `Up to ${inr(max)}${suffix}`);
  if (stipend)
    return make(`Pays a stipend of ${inr(stipend)} ${spoken}`, `${inr(stipend)}${suffix}`);

  if (o.isPaid === false) {
    return make(
      o.kind === "internship"
        ? "Unpaid: the listing says there is no stipend"
        : "Unpaid: the listing says so",
      "Unpaid",
    );
  }
  if (figureQuote) {
    return {
      key: "pay",
      label: LABEL.pay,
      text: "No pay figure is given as a number; the text mentions pay",
      quote: clipQuote(figureQuote),
      missing: false,
    };
  }
  return missing("pay", LABEL.pay);
}

function decodeWhere(o: Opportunity): DecodedBullet {
  const location = clean(o.location);
  const region = clean(o.region);
  const place = location || region;
  const mode = o.workMode as string | null | undefined;

  let modePhrase: string | null = null;
  if (mode === "onsite") {
    modePhrase = place
      ? `Works from ${place} (on-site)`
      : "On-site, but the listing does not say where";
  } else if (mode === "hybrid") {
    modePhrase = place
      ? `Hybrid, based in ${place} (some days on-site, some remote)`
      : "Hybrid, but the listing does not say where";
  } else if (mode === "remote") {
    modePhrase = place ? `Works remotely (listed place: ${place})` : "Works remotely";
  } else if (place) {
    modePhrase = `Based in ${place}`;
  }

  const when: string[] = [];
  if (typeof o.hoursPerWeek === "number" && o.hoursPerWeek > 0) {
    when.push(`about ${o.hoursPerWeek} ${plural(o.hoursPerWeek, "hour")} a week`);
  }
  if (typeof o.durationWeeks === "number" && o.durationWeeks > 0) {
    when.push(`lasts ${o.durationWeeks} ${plural(o.durationWeeks, "week")}`);
  }
  const deadline = dateLabel(o.deadline);
  if (deadline) when.push(`apply by ${deadline}`);

  const knowsWhere = Boolean(place) || mode === "remote";
  if (!knowsWhere && when.length === 0) return missing("where", LABEL.where);

  const head = modePhrase ?? "Where it is done is not stated in the listing";
  const quote = place
    ? clipQuote(place)
    : (() => {
        const s = snippet(
          [o.description, o.summary, ...cleanList(o.responsibilities)],
          REMOTE_WORD,
        );
        return s ? clipQuote(s) : null;
      })();

  return {
    key: "where",
    label: LABEL.where,
    text: when.length > 0 ? `${head} · ${when.join(" · ")}` : head,
    quote,
    missing: false,
  };
}

function decodeWho(o: Opportunity): DecodedBullet {
  const eligibility = clean(o.eligibility);
  const experience = clean(o.details?.experience);
  const skills = cleanList(o.skills);

  const parts: string[] = [];
  if (experience) parts.push(sentence(`Experience: ${clipQuote(experience, 60)}`));
  if (eligibility) parts.push(sentence(`Eligibility: ${clipQuote(eligibility, 120)}`));
  if (skills.length > 0) {
    const shown = skills.slice(0, 5).join(", ");
    const more = skills.length - 5;
    parts.push(`Skills asked for: ${shown}${more > 0 ? ` and ${more} more` : ""}.`);
  }
  if (parts.length === 0) return missing("who", LABEL.who);

  return {
    key: "who",
    label: LABEL.who,
    text: parts.join(" "),
    quote: eligibility ? clipQuote(eligibility) : experience ? clipQuote(experience) : null,
    missing: false,
  };
}

function decodeExtra(o: Opportunity): DecodedBullet | null {
  const benefits = cleanList(o.details?.benefits);
  if (benefits.length > 0) {
    const shown = benefits
      .slice(0, 3)
      .map((b) => clipQuote(b, 40))
      .join(", ");
    const more = benefits.length - 3;
    return {
      key: "extra",
      label: LABEL.extra,
      text: `Comes with: ${shown}${more > 0 ? ` and ${more} more` : ""}`,
      quote: clipQuote(benefits[0]),
      missing: false,
    };
  }
  const learn = cleanList(o.details?.whatYouLearn);
  if (learn.length > 0) {
    const shown = learn
      .slice(0, 2)
      .map((b) => clipQuote(b, 50))
      .join("; ");
    return {
      key: "extra",
      label: LABEL.extra,
      text: `You would learn: ${shown}`,
      quote: clipQuote(learn[0]),
      missing: false,
    };
  }
  if (typeof o.openings === "number" && o.openings > 1) {
    return {
      key: "extra",
      label: LABEL.extra,
      text: `${o.openings} openings for this role`,
      quote: null,
      missing: false,
    };
  }
  return null;
}

export function decodeOpportunity(o: Opportunity): DecodedBullet[] {
  const out = [decodeDo(o), decodePay(o), decodeWhere(o), decodeWho(o)];
  const extra = decodeExtra(o);
  if (extra) out.push(extra);
  return out;
}

/* ── courses ────────────────────────────────────────────────────────────── */

export function decodeCourse(c: Course): DecodedBullet[] {
  const out: DecodedBullet[] = [courseLearn(c), courseFee(c), courseWhere(c), courseWho(c)];
  const extra = courseExtra(c);
  if (extra) out.push(extra);
  return out;
}

function courseLearn(c: Course): DecodedBullet {
  const outcomes = cleanList(c.outcomes);
  if (outcomes.length > 0) {
    const more = outcomes.length - 1;
    return {
      key: "do",
      label: LABEL.learn,
      text: `By the end, you'll be able to: ${clipQuote(outcomes[0], 80)}${more > 0 ? ` (${more} more listed)` : ""}`,
      quote: clipQuote(outcomes[0]),
      missing: false,
    };
  }
  const overview = clean(c.overview);
  if (overview) {
    const s = firstSentence(overview);
    return {
      key: "do",
      label: LABEL.learn,
      text: `The course overview says: ${clipQuote(s, 110)}`,
      quote: clipQuote(s),
      missing: false,
    };
  }
  return missing("do", LABEL.learn);
}

function courseFee(c: Course): DecodedBullet {
  const fees = clean(c.fees);
  const free = c.free === true || /^free\b/i.test(fees);
  if (free) {
    return {
      key: "pay",
      label: LABEL.fee,
      text: "Free: no fee to take this course",
      quote: fees ? clipQuote(fees) : null,
      missing: false,
    };
  }
  if (fees) {
    return {
      key: "pay",
      label: LABEL.fee,
      text: `Costs ${clipQuote(fees, 60)}${c.scholarship ? " (a scholarship is available)" : ""}`,
      quote: clipQuote(fees),
      missing: false,
    };
  }
  return missing("pay", LABEL.fee);
}

function courseWhere(c: Course): DecodedBullet {
  const city = clean(c.city);
  const state = clean(c.state);
  const place = [city, state].filter(Boolean).join(", ");
  const duration = clean(c.duration);
  const mode = c.mode as string | null | undefined;
  const online = mode === "Online";

  let head: string | null = null;
  if (online) head = "Online";
  else if (mode === "Offline")
    head = place ? `In person in ${place}` : "In person, but the place is not stated";
  else if (mode === "Hybrid")
    head = place ? `Hybrid, based in ${place}` : "Hybrid, but the place is not stated";

  const { parts: durationParts, selfPaced } = durationPhrase(duration);
  const parts: string[] = [];
  if (head) parts.push(head);
  parts.push(...durationParts);
  if (
    typeof c.hoursPerWeek === "number" &&
    c.hoursPerWeek > 0 &&
    !/hrs?\s*\/\s*week|hours?\s*\/\s*week/i.test(duration)
  ) {
    parts.push(`about ${c.hoursPerWeek} ${plural(c.hoursPerWeek, "hour")} a week`);
  }
  const start = dateLabel(c.startsOn);
  if (start) parts.push(`next batch starts ${start}`);
  else if (online) parts.push("start any time, self-paced");
  else if (selfPaced) parts.push("self-paced");
  else if (head) parts.push("next batch: ask the institute");

  if (parts.length === 0) return missing("where", LABEL.where);
  return {
    key: "where",
    label: LABEL.where,
    text: parts.join(" · "),
    quote: duration ? clipQuote(duration) : !online && city ? clipQuote(city) : null,
    missing: false,
  };
}

/**
 * A listing's duration ("About 16 hours · self-paced", "3 months · 10 hrs/week")
 * as phrases that read well mid-line: a capitalized leading word is lowercased
 * ("about 16 hours"), and "self-paced" is lifted out so the caller can say it
 * once instead of twice.
 */
export function durationPhrase(duration: string): { parts: string[]; selfPaced: boolean } {
  let selfPaced = false;
  const parts: string[] = [];
  for (const raw of (duration ?? "").split(/\s*[·|]\s*/)) {
    const part = raw.trim();
    if (!part) continue;
    if (/^self[-\s]?paced$/i.test(part)) {
      selfPaced = true;
      continue;
    }
    const phrase = /^[A-Z][a-z]/.test(part) ? part[0].toLowerCase() + part.slice(1) : part;
    parts.push(clipQuote(phrase, 60));
  }
  return { parts, selfPaced };
}

function courseWho(c: Course): DecodedBullet {
  const level = clean(c.difficulty);
  const prerequisites = cleanList(c.prerequisites);
  const language = clean(c.language);

  const parts: string[] = [];
  if (level) parts.push(`${level} level`);
  if (prerequisites.length > 0) {
    parts.push(
      `you need first: ${prerequisites
        .slice(0, 3)
        .map((p) => clipQuote(p, 40))
        .join(", ")}`,
    );
  } else if (level) {
    parts.push(level === "Beginner" ? "no prerequisites listed" : "prerequisites not stated");
  }
  if (language) parts.push(`taught in ${clipQuote(language, 40)}`);

  if (parts.length === 0) return missing("who", LABEL.who);
  return {
    key: "who",
    label: LABEL.who,
    text: parts.join(" · "),
    quote:
      prerequisites.length > 0
        ? clipQuote(prerequisites[0])
        : language
          ? clipQuote(language)
          : null,
    missing: false,
  };
}

function courseExtra(c: Course): DecodedBullet | null {
  const certification = clean(c.certification);
  if (certification) {
    return {
      key: "extra",
      label: LABEL.extra,
      text: `Certificate: ${clipQuote(certification, 70)}${c.placementAssistance ? " · placement help offered" : ""}`,
      quote: clipQuote(certification),
      missing: false,
    };
  }
  if (c.placementAssistance) {
    return {
      key: "extra",
      label: LABEL.extra,
      text: "Placement help is offered after the course",
      quote: null,
      missing: false,
    };
  }
  return null;
}
