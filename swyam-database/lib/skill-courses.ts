import { courses, type Course } from "../data/mock";
import { skillCategories, type NicheSkill } from "../data/topics";

/**
 * Joins the skills library to the course catalogue.
 *
 * These were two separate worlds. A skill card listed "recommended courses" as
 * three plain strings — "Python for Data Science", "Automate the Boring Stuff"
 * — none of which were courses on this site, none of which linked anywhere,
 * and the one button underneath went to the unfiltered catalogue. So the page
 * that exists to help someone choose a skill ended by handing them the same
 * forty courses they started with.
 *
 * The match is scored rather than hard-coded, because the two lists were
 * written independently and a lookup table between them would be wrong the
 * first time either side changed. What a course is called, what it teaches and
 * what it is filed under all count; a skill's own recommendations count most,
 * since those were written with specific courses in mind even when the names
 * drifted.
 */

const STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "your",
  "into",
  "from",
  "using",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "or",
  "&",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function haystack(course: Course): string {
  return [
    course.title,
    course.category,
    course.group,
    course.overview,
    ...course.outcomes,
    ...course.curriculum.map((m) => m.module),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * How well one course answers one skill.
 *
 * Weighted so a course whose *title* carries the skill's name beats one that
 * merely mentions it in a module description — otherwise every broad course
 * with a long syllabus wins every skill.
 */
function score(skill: NicheSkill, course: Course): number {
  const hay = haystack(course);
  const title = course.title.toLowerCase();
  let points = 0;

  // The skill's own name, in the course title, is the strongest signal there is.
  const nameTokens = tokens(skill.title);
  for (const t of nameTokens) {
    if (title.includes(t)) points += 6;
    else if (hay.includes(t)) points += 2;
  }

  // A recommendation that names this course, however loosely.
  for (const rec of skill.recommendedCourses) {
    const recTokens = tokens(rec);
    if (recTokens.length === 0) continue;
    const hits = recTokens.filter((t) => title.includes(t)).length;
    if (hits >= 2 || (hits === 1 && recTokens.length === 1)) points += 5;
    else if (hits === 1) points += 2;
  }

  // Competencies are what the learner will be able to do, so a course that
  // teaches them is on topic even when nothing else lines up by name.
  for (const c of skill.competencies) {
    const ct = tokens(c);
    const hits = ct.filter((t) => hay.includes(t)).length;
    if (ct.length > 0 && hits / ct.length > 0.6) points += 2;
  }

  return points;
}

/**
 * Real courses that teach this skill, best first.
 *
 * Returns an empty list rather than a weak guess: "no course covers this yet"
 * is a true and useful answer, and it is the one that sends somebody to the AI
 * mentor instead of to a course that will waste their week.
 */
export function coursesForSkill(skill: NicheSkill, limit = 3): Course[] {
  return courses
    .map((c) => ({ c, s: score(skill, c) }))
    .filter((x) => x.s >= 6)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Every skill in the library, flattened, with the category it sits in. */
export function allSkills(): Array<{ skill: NicheSkill; category: string }> {
  return skillCategories.flatMap((cat) =>
    cat.skills.map((skill) => ({ skill, category: cat.name })),
  );
}

/**
 * The reverse lookup: which skill tracks does this course belong to?
 *
 * Used on a course page so the catalogue is not a dead end either — somebody
 * looking at "Robotics & IoT using Arduino" can see it sits under a skill with
 * a difficulty, a time to job-ready and a set of competencies.
 */
export function skillsForCourse(
  course: Course,
  limit = 3,
): Array<{
  skill: NicheSkill;
  category: string;
}> {
  return allSkills()
    .map((entry) => ({ entry, s: score(entry.skill, course) }))
    .filter((x) => x.s >= 6)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.entry);
}

/* ── Tags ──────────────────────────────────────────────────────────────
 * A "tag" is a skill name in one normalised spelling: what an opening asks for,
 * what a course teaches, what a skill track is called. The Intent Lane counts
 * tags across everything a visitor opened, so the spelling has to agree
 * everywhere. Pure and local: no network, no clock, no randomness.
 */

const ALIASES: Readonly<Record<string, string>> = {
  "ms excel": "excel",
  "microsoft excel": "excel",
  "advanced excel": "excel",
  "spoken english": "english",
  "english speaking": "english",
  "english communication": "english",
  "customer service": "customer support",
  "customer care": "customer support",
  "ms office": "office tools",
  "microsoft office": "office tools",
  "tally erp": "tally",
  "tally prime": "tally",
  "communication skills": "communication",
  "data analytics": "data analysis",
  "content creation": "content writing",
  "digital marketing": "marketing",
  "graphic design": "design",
  "social media marketing": "social media",
};

/** Skills every role mentions; they rank after the specific gaps. */
const GENERIC_TAGS: ReadonlySet<string> = new Set([
  "communication",
  "english",
  "office tools",
  "teamwork",
]);

/** Other ways a course title says the same thing as a tag. */
const COURSE_WORDS: Readonly<Record<string, readonly string[]>> = {
  "customer support": ["customer service", "customer support"],
  communication: ["communication", "public speaking", "spoken english"],
  english: ["spoken english", "english"],
  sales: ["sales", "selling"],
  marketing: ["digital marketing", "marketing"],
  design: ["graphic design", "ui ux", "design"],
  "content writing": ["content creation", "content writing", "copywriting"],
  "data analysis": ["data analytics", "data analysis"],
  accounting: ["financial literacy", "accounting", "bookkeeping"],
  "web development": ["full stack", "web development", "web design"],
  "social media": ["social media", "content creation"],
  python: ["python"],
  sql: ["sql", "data analytics"],
};

export function normTag(raw: string): string {
  const t = raw
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
  return ALIASES[t] ?? t;
}

export const isGenericTag = (tag: string): boolean => GENERIC_TAGS.has(tag);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, phrase: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}([^a-z0-9]|$)`).test(text);

/** 0 = does not teach it; 8 = in the title; 3 = elsewhere in the syllabus. */
function tagScore(course: Course, tag: string): number {
  const words = COURSE_WORDS[tag] ?? [tag];
  const title = course.title.toLowerCase();
  if (words.some((w) => hasWord(title, w))) return 8;
  const hay = haystack(course);
  const toks = tokens(tag);
  if (words.some((w) => hasWord(hay, w))) return 3;
  return toks.length > 0 && toks.every((t) => hasWord(hay, t)) ? 3 : 0;
}

export const courseTeaches = (course: Course, tag: string): boolean => tagScore(course, tag) > 0;

/** Real courses that teach this tag, best first; [] when none do. Ties break on enrolment, then id. */
export function coursesForTag(tag: string, limit = 3): Course[] {
  return courses
    .map((c) => ({ c, s: tagScore(c, tag) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.enrolled - a.c.enrolled || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map((x) => x.c);
}

/** Which of the known tags this course teaches. */
export const courseTagsFor = (course: Course, universe: ReadonlyArray<string>): string[] =>
  universe.filter((t) => tagScore(course, t) >= 3);

/** The skill track's own name, plus any known tag its title or competencies name. */
export function skillTagsFor(skill: NicheSkill, universe: ReadonlyArray<string>): string[] {
  const text = [skill.title, ...skill.competencies].join(" ").toLowerCase();
  const out = new Set<string>([normTag(skill.title)]);
  for (const t of universe) if (hasWord(text, t)) out.add(t);
  return [...out];
}
