/**
 * Keyword-first matching for "Say it".
 *
 * No network and no model: a phrase is lower-cased, stripped of Latin accents
 * and punctuation, and looked up against word lists that include Hinglish
 * spellings (naukri, sikhna, kursa, muft ...) and a few Devanagari words. The
 * longest phrase that matches wins, so "my courses" beats "courses".
 *
 * Words that narrow a listing (remote, free) only apply when the winner is a
 * kind of opening (job, internship, course, work); then the answer is the
 * all-openings page with those filters. Everything returned is an
 * `IntentMatch`; the caller still validates it.
 */
import type { IntentKind, IntentMatch, IntentRouteId } from "./routes";

/*
 * Built from strings so the source stays ASCII. Only Latin accents (U+0300 to U+036F) are stripped:
 * Devanagari vowel signs are combining marks too and must stay. The word class keeps a to z, 0 to 9
 * and the Devanagari block (U+0900 to U+097F).
 */
const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g");
// eslint-disable-next-line no-misleading-character-class
const NOT_WORD = new RegExp("[^a-z0-9\\u0900-\\u097f]+", "g");

/** Lower-case, accent-free, letters, digits and Devanagari only, single spaces. */
export function normalizePhrase(raw: string): string {
  return raw.normalize("NFKD").toLowerCase().replace(ACCENTS, "").replace(NOT_WORD, " ").trim();
}

interface Word {
  words: readonly string[];
}
const N = (list: readonly string[]): string[] => list.map(normalizePhrase).filter(Boolean);

const KINDS: Array<Word & { kind: IntentKind }> = [
  {
    kind: "internship",
    words: N([
      "internship",
      "internships",
      "intern",
      "interns",
      "apprenticeship",
      "apprentice",
      "इंटर्नशिप",
      "इंटर्न",
    ]),
  },
  {
    kind: "job",
    words: N([
      "job",
      "jobs",
      "naukri",
      "naukari",
      "nokri",
      "nokari",
      "rozgar",
      "rojgar",
      "vacancy",
      "vacancies",
      "hiring",
      "placement",
      "नौकरी",
      "रोजगार",
    ]),
  },
  {
    kind: "course",
    words: N([
      "course",
      "courses",
      "kursa",
      "kurs",
      "kors",
      "class",
      "classes",
      "sikhna",
      "seekhna",
      "sikhne",
      "seekhne",
      "sikho",
      "seekho",
      "sikhe",
      "learn",
      "learning",
      "study",
      "padhna",
      "padhai",
      "training",
      "tutorial",
      "tutorials",
      "कोर्स",
      "सीखना",
      "सीखने",
      "सीखो",
      "पढ़ाई",
      "पढ़ना",
    ]),
  },
  {
    kind: "work",
    words: N(["kaam", "freelance", "gig", "part time", "parttime", "paid work", "काम"]),
  },
];

const REMOTE = N([
  "remote",
  "remotely",
  "wfh",
  "work from home",
  "ghar se",
  "ghar baithe",
  "रिमोट",
  "घर से",
  "घर बैठे",
]);
const FREE = N([
  "free",
  "muft",
  "mufat",
  "mufta",
  "gratis",
  "bina paisa",
  "bina paise",
  "free of cost",
  "zero cost",
  "मुफ्त",
  "फ्री",
  "निशुल्क",
]);

const DESTINATIONS: Array<Word & { id: IntentRouteId }> = [
  { id: "HOME", words: N(["home", "homepage", "होम"]) },
  { id: "EXPLORE", words: N(["explore", "everything", "sab kuch", "सब कुछ"]) },
  {
    id: "MY_COURSES",
    words: N([
      "my courses",
      "my course",
      "my learning",
      "mere courses",
      "mere course",
      "meri learning",
      "मेरे कोर्स",
    ]),
  },
  { id: "PRACTICE", words: N(["practice", "practise", "abhyas", "अभ्यास"]) },
  { id: "SKILL_BUILDER", words: N(["skill builder", "build skills", "skill banao"]) },
  {
    id: "OPPORTUNITIES",
    words: N(["all openings", "opportunities", "opportunity", "openings", "sab openings"]),
  },
  {
    id: "APPLICATIONS",
    words: N([
      "applications",
      "my applications",
      "mere applications",
      "meri applications",
      "application status",
    ]),
  },
  { id: "CAREER_LAUNCHER", words: N(["career", "careers", "career launcher", "करियर"]) },
  {
    id: "CV",
    words: N(["cv", "resume", "biodata", "bio data", "cv review", "रिज्यूमे", "बायोडाटा"]),
  },
  { id: "COACH", words: N(["coach", "coaching", "mentor", "guidance", "margdarshan"]) },
  {
    id: "SKILLS",
    words: N([
      "swap",
      "swaps",
      "skill swap",
      "skillswap",
      "skill exchange",
      "exchange",
      "adla badli",
      "badla badli",
      "स्वैप",
    ]),
  },
  {
    id: "SKILL_DIRECTORY",
    words: N([
      "mere skills",
      "meri skills",
      "mera skill",
      "my skills",
      "my skill",
      "skills",
      "skill",
      "skill directory",
      "skill list",
    ]),
  },
  { id: "MATCHES", words: N(["matches", "my matches", "match", "mere matches"]) },
  {
    id: "PASSPORT",
    words: N(["passport", "skill passport", "pasport", "certificate", "certificates"]),
  },
  { id: "COMMUNITY", words: N(["community", "forum", "samuday", "कम्युनिटी"]) },
  { id: "MESSAGES", words: N(["messages", "message", "inbox", "chat", "chats", "sandesh", "msg"]) },
  { id: "EVENTS", words: N(["events", "event", "workshop", "workshops", "meetup", "mela"]) },
  {
    id: "PROFILE",
    words: N(["profile", "my profile", "meri profile", "mera profile", "प्रोफाइल"]),
  },
  {
    id: "DASHBOARD",
    words: N(["dashboard", "my dashboard", "mera dashboard", "progress", "प्रगति"]),
  },
  {
    id: "SAVED",
    words: N(["saved", "bookmarks", "bookmark", "wishlist", "save kiye", "saved items"]),
  },
  {
    id: "SCHEMES",
    words: N([
      "scheme",
      "schemes",
      "yojana",
      "yojna",
      "sarkari yojana",
      "government scheme",
      "subsidy",
      "योजना",
      "सरकारी योजना",
    ]),
  },
  {
    id: "RESOURCES",
    words: N(["resources", "resource", "downloads", "guides", "guide", "samagri"]),
  },
  { id: "TRUST", words: N(["trust", "trust center", "trust center", "safety", "verified"]) },
  {
    id: "SETTINGS",
    words: N([
      "settings",
      "setting",
      "preferences",
      "language",
      "theme",
      "dark mode",
      "text size",
      "सेटिंग",
    ]),
  },
  { id: "NOTIFICATIONS", words: N(["notifications", "notification", "alerts", "alert", "bell"]) },
  { id: "REWARDS", words: N(["rewards", "reward", "points", "coins", "badges", "badge", "inaam"]) },
];

/** "search for X", "find X", "khojo X": only used when nothing above matched. */
const SEARCH_VERB = new RegExp(
  `^(?:${N(["search", "find", "look for", "dhundo", "dhundho", "dhoondo", "khojo", "khoj", "खोजो", "ढूंढो"]).join("|")})(?: for)? (.+)$`,
);

const KIND_PAGE: Record<IntentKind, IntentRouteId> = {
  job: "JOBS",
  internship: "INTERNSHIPS",
  course: "COURSES",
  work: "OPPORTUNITIES",
};

/** The longest listed phrase found as whole words in `padded`, or 0. */
function best(padded: string, words: readonly string[]): number {
  let len = 0;
  for (const w of words) if (w.length > len && padded.includes(` ${w} `)) len = w.length;
  return len;
}

/** `padded` with every listed phrase removed, so "work from home jobs" is just "jobs" plus a modifier. */
function without(padded: string, words: readonly string[]): string {
  let out = padded;
  for (const w of [...words].sort((a, b) => b.length - a.length))
    out = out.split(` ${w} `).join(" ");
  return out;
}

/** A destination for the phrase, or null when no keyword applies (the caller may then ask the server). */
export function matchKeywords(phrase: string): IntentMatch | null {
  const text = normalizePhrase(phrase);
  if (!text) return null;
  const padded = ` ${text} `;

  const remote = best(padded, REMOTE) > 0;
  const free = best(padded, FREE) > 0;
  const rest = without(without(padded, REMOTE), FREE);

  let top: { len: number; kind?: IntentKind; id?: IntentRouteId } | null = null;
  // Destinations are tried first, so on a tie "skills" does not lose to a kind word.
  for (const d of DESTINATIONS) {
    const len = best(rest, d.words);
    if (len > (top?.len ?? 0)) top = { len, id: d.id };
  }
  for (const k of KINDS) {
    const len = best(rest, k.words);
    if (len > (top?.len ?? 0)) top = { len, kind: k.kind };
  }

  const filters: Record<string, string> = {};
  if (remote) filters["remote"] = "1";
  if (free) filters["free"] = "1";

  if (top?.kind) {
    if (remote || free) {
      return { routeId: "OPPORTUNITIES", filters: { kind: top.kind, ...filters } };
    }
    return { routeId: KIND_PAGE[top.kind], filters: {} };
  }
  if (top?.id) return { routeId: top.id, filters: {} };
  if (remote || free) return { routeId: "OPPORTUNITIES", filters };

  const trimmed = rest.trim();
  if (trimmed === "search" || trimmed === "khojo" || trimmed === "dhundo") {
    return { routeId: "SEARCH", filters: {} };
  }
  const q = trimmed.match(SEARCH_VERB)?.[1];
  if (q) return { routeId: "SEARCH", filters: { q: q.slice(0, 60).trim() } };
  return null;
}
