/**
 * The Intent Lane model (council F4): one cross-service path derived from the
 * tags of the things a visitor keeps opening.
 *
 *   tags that recur  ->  Learn (a course)  ->  Prove (skill check / CV / passport)  ->  Apply (an open role)
 *
 * Deterministic, local, no sensitive input: it reads only public entity slugs
 * already in the on-device behaviour log, resolved against the catalogue. No
 * clock, no randomness, no network. Every step carries a receipt that says
 * which of the visitor's own views it came from. A percentage never appears
 * here for a visitor; a count of skills a signed-in member lists may.
 */
import type { Course } from "@/data/mock";
import { isSampleOpening } from "@/data/mock";
import type { HomeLayout } from "@/evolution/types";
import { matchAgainst, type Opportunity } from "@/lib/opportunities";
import {
  courseTagsFor,
  coursesForTag,
  isGenericTag,
  normTag,
  skillTagsFor,
} from "@/lib/skill-courses";
import type { EntityView } from "../resolve";

/** A tag must show up in this many distinct things before it counts as a pattern. */
export const MIN_RECURRENCE = 2;
/** The lane needs this many recurring tags, otherwise it says so instead of guessing. */
export const MIN_TAGS = 2;

export type LaneStepKind = "learn" | "swap" | "ask" | "prove" | "apply";

export interface LaneStep {
  kind: LaneStepKind;
  /** Short verb shown as the kicker: Learn, Swap, Ask, Prove, Apply. */
  verb: string;
  title: string;
  sub: string | null;
  /** Where in the visitor's own views this step came from. Always present. */
  receipt: string;
  href: string;
  cta: string;
  alt: ReadonlyArray<{ href: string; label: string }>;
  /** True when the step points at a labelled sample listing. */
  sample: boolean;
}

export interface LaneTag {
  tag: string;
  label: string;
  jobs: number;
  internships: number;
  others: number;
  total: number;
  held: boolean;
}

export type IntentLane =
  | { status: "empty"; recurring: number; seen: number }
  | { status: "ready"; tags: LaneTag[]; focus: LaneTag; steps: LaneStep[]; held: boolean };

export interface LaneInput {
  views: ReadonlyArray<EntityView>;
  openings: ReadonlyArray<Opportunity>;
  layout: HomeLayout;
  signedIn: boolean;
  /** Skill names a signed-in member lists on their profile; [] for a visitor. */
  mySkills: ReadonlyArray<string>;
}

const EMPTY: IntentLane = { status: "empty", recurring: 0, seen: 0 };

/** Every tag any opening asks for, sorted, so every other function shares one vocabulary. */
export function tagUniverse(openings: ReadonlyArray<Opportunity>): string[] {
  const out = new Set<string>();
  for (const o of openings) for (const s of o.skills) if (normTag(s)) out.add(normTag(s));
  return [...out].sort();
}

/** First-seen display spelling per tag ("SQL", "Customer support"). */
export function tagLabels(openings: ReadonlyArray<Opportunity>): Map<string, string> {
  const labels = new Map<string, string>();
  for (const o of openings)
    for (const s of o.skills) {
      const t = normTag(s);
      if (t && !labels.has(t)) labels.set(t, s.trim());
    }
  return labels;
}

const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const labelOf = (labels: Map<string, string>, tag: string): string =>
  labels.get(tag) ?? capital(tag);

export function tagsOfView(v: EntityView, universe: ReadonlyArray<string>): string[] {
  switch (v.kind) {
    case "job":
    case "internship":
      return [...new Set(v.opening.skills.map(normTag).filter(Boolean))];
    case "course":
      return courseTagsFor(v.course, universe);
    case "skill":
      return skillTagsFor(v.skill, universe);
  }
}

export const tagsOfOpening = (o: Opportunity): string[] => [
  ...new Set(o.skills.map(normTag).filter(Boolean)),
];

/** Slugs and ids the visitor has already looked at; they are never offered back. */
export function viewedKeys(views: ReadonlyArray<EntityView>): Set<string> {
  return new Set(views.map((v) => v.id.toLowerCase()));
}

/** "2 jobs and 1 internship you viewed". */
function seenPhrase(t: LaneTag): string {
  const parts: string[] = [];
  if (t.jobs) parts.push(`${t.jobs} ${t.jobs === 1 ? "job" : "jobs"}`);
  if (t.internships)
    parts.push(`${t.internships} ${t.internships === 1 ? "internship" : "internships"}`);
  return `${parts.join(" and ")} you viewed`;
}

const receiptOf = (t: LaneTag): string =>
  t.jobs + t.internships > 0
    ? `Asked for in ${seenPhrase(t)}`
    : `Came up in ${t.total} ${t.total === 1 ? "thing" : "things"} you opened`;

/** Count each tag once per distinct thing viewed. */
function countTags(
  views: ReadonlyArray<EntityView>,
  universe: ReadonlyArray<string>,
  labels: Map<string, string>,
  held: ReadonlySet<string>,
): { all: LaneTag[]; seen: number } {
  const byTag = new Map<string, LaneTag>();
  const done = new Set<string>();
  for (const v of views) {
    const key = `${v.kind}:${v.id}`;
    if (done.has(key)) continue;
    done.add(key);
    for (const tag of tagsOfView(v, universe)) {
      const t =
        byTag.get(tag) ??
        ({
          tag,
          label: labelOf(labels, tag),
          jobs: 0,
          internships: 0,
          others: 0,
          total: 0,
          held: held.has(tag),
        } satisfies LaneTag);
      if (v.kind === "job") t.jobs++;
      else if (v.kind === "internship") t.internships++;
      else t.others++;
      t.total++;
      byTag.set(tag, t);
    }
  }
  return { all: [...byTag.values()], seen: byTag.size };
}

/** Specific gaps first, everyday skills last; then what employers asked for; then a stable spelling. */
function rankTags(a: LaneTag, b: LaneTag): number {
  return (
    Number(a.held) - Number(b.held) ||
    Number(isGenericTag(a.tag)) - Number(isGenericTag(b.tag)) ||
    b.jobs + b.internships - (a.jobs + a.internships) ||
    b.total - a.total ||
    a.label.localeCompare(b.label)
  );
}

function pickCourse(tag: string, seen: ReadonlySet<string>): Course | null {
  const list = coursesForTag(tag, 4);
  return list.find((c) => !seen.has(c.id.toLowerCase())) ?? list[0] ?? null;
}

const signIn = (next: string): string => `/auth?mode=login&next=${encodeURIComponent(next)}`;

function openingHref(o: Opportunity): string {
  const list = o.kind === "internship" ? "/internships" : "/jobs";
  return isSampleOpening(o) ? list : `${list}/${o.slug}`;
}

export function buildIntentLane(input: LaneInput): IntentLane {
  const { views, openings, layout, signedIn } = input;
  if (views.length === 0) return EMPTY;
  const universe = tagUniverse(openings);
  const labels = tagLabels(openings);
  const mine = new Set(input.mySkills.map(normTag));
  const heldTags = signedIn ? mine : new Set<string>();

  const { all, seen } = countTags(views, universe, labels, heldTags);
  const recurring = all.filter((t) => t.total >= MIN_RECURRENCE).sort(rankTags);
  if (recurring.length < MIN_TAGS) return { status: "empty", recurring: recurring.length, seen };

  const viewedCourseIds = new Set(
    views.filter((v) => v.kind === "course").map((v) => v.id.toLowerCase()),
  );
  // The first tag a real course teaches makes the Learn step concrete; otherwise the top tag leads.
  const focus =
    recurring.find((t) => pickCourse(t.tag, viewedCourseIds)) ?? (recurring[0] as LaneTag);
  const course = pickCourse(focus.tag, viewedCourseIds);
  const steps: LaneStep[] = [];

  // Learn
  steps.push(
    course
      ? {
          kind: "learn",
          verb: "Learn",
          title: focus.held ? `Keep ${focus.label} sharp: ${course.title}` : course.title,
          sub: `${course.duration} · ${course.free ? "Free" : course.fees}`,
          receipt: receiptOf(focus),
          href: `/courses/${course.id}`,
          cta: viewedCourseIds.has(course.id.toLowerCase())
            ? "Pick this course back up"
            : "Start this course",
          alt: [],
          sample: false,
        }
      : {
          kind: "learn",
          verb: "Learn",
          title: `No course covers ${focus.label} yet`,
          sub: "Sarthi can build a learning path around it.",
          receipt: receiptOf(focus),
          href: "/coach#path",
          cta: "Build my learning path",
          alt: [],
          sample: false,
        },
  );

  // Skills / Community steps follow the state the lane sits in.
  if (layout === "SKILL_EXCHANGE_HUB")
    steps.push({
      kind: "swap",
      verb: "Swap",
      title: `Trade ${focus.label} with someone`,
      sub: "Offer a skill you hold and learn this one in return.",
      receipt: `${focus.label} came up in ${focus.total} ${focus.total === 1 ? "thing" : "things"} you opened`,
      href: signedIn ? "/skillswap" : "/board",
      cta: "Find a swap",
      alt: [],
      sample: false,
    });
  if (layout === "COMMUNITY_HUB")
    steps.push({
      kind: "ask",
      verb: "Ask",
      title: `Ask people who learned ${focus.label}`,
      sub: "Questions and answers from other learners.",
      receipt: `${focus.label} came up in ${focus.total} ${focus.total === 1 ? "thing" : "things"} you opened`,
      href: "/community",
      cta: "Open the community",
      alt: [],
      sample: false,
    });

  // Prove
  const roleViews = views.filter(
    (v): v is Extract<EntityView, { kind: "job" | "internship" }> =>
      (v.kind === "job" || v.kind === "internship") && tagsOfOpening(v.opening).includes(focus.tag),
  );
  const latestRole = roleViews[0];
  const passport = {
    href: signedIn ? "/passport" : signIn("/passport"),
    label: "Open my Skill Passport",
  };
  const skillCheck = { href: "/board", label: "Take a skill check" };
  const proofReceipt =
    focus.jobs + focus.internships > 0
      ? `Backs up ${focus.label}, asked for in ${seenPhrase(focus)}`
      : `Backs up ${focus.label}, which came up ${focus.total} times`;
  if (layout === "SKILL_EXCHANGE_HUB")
    steps.push({
      kind: "prove",
      verb: "Prove",
      title: `Put ${focus.label} on your Skill Passport`,
      sub: "A verified skill is worth more than a claimed one.",
      receipt: proofReceipt,
      href: passport.href,
      cta: passport.label,
      alt: [skillCheck],
      sample: false,
    });
  else if (latestRole)
    steps.push({
      kind: "prove",
      verb: "Prove",
      title: `Check your CV against ${latestRole.opening.title}`,
      sub: "Shows what the role asks for that your CV does not yet say.",
      receipt: proofReceipt,
      href: isSampleOpening(latestRole.opening)
        ? "/cv"
        : `/cv?for=${encodeURIComponent(latestRole.id)}`,
      cta: "Review my CV",
      alt: [skillCheck, passport],
      sample: false,
    });
  else
    steps.push({
      kind: "prove",
      verb: "Prove",
      title: `Take a ${focus.label} skill check`,
      sub: "A short check you can attach to your profile.",
      receipt: proofReceipt,
      href: skillCheck.href,
      cta: "Start the check",
      alt: [{ href: "/cv", label: "Review my CV" }, passport],
      sample: false,
    });

  // Apply: an open opening not yet viewed that asks for these tags.
  const seenKeys = viewedKeys(views);
  const laneTags = recurring.map((t) => t.tag);
  const internshipLean =
    views.filter((v) => v.kind === "internship").length >
    views.filter((v) => v.kind === "job").length;
  const scored = openings
    .filter((o) => !seenKeys.has(o.slug.toLowerCase()))
    .map((o) => {
      const tags = tagsOfOpening(o);
      const overlap = laneTags.filter((t) => tags.includes(t)).length;
      const hasFocus = tags.includes(focus.tag);
      return { o, tags, score: (hasFocus ? 3 : 0) + overlap, hasFocus, overlap };
    })
    .filter((x) => x.hasFocus || x.overlap > 0)
    .sort(
      (a, b) =>
        Number(isSampleOpening(a.o)) - Number(isSampleOpening(b.o)) ||
        b.score - a.score ||
        Number((b.o.kind === "internship") === internshipLean) -
          Number((a.o.kind === "internship") === internshipLean) ||
        a.o.slug.localeCompare(b.o.slug),
    );
  const pick = scored[0];
  if (pick) {
    const shared = laneTags.filter((t) => pick.tags.includes(t)).map((t) => labelOf(labels, t));
    const sample = isSampleOpening(pick.o);
    const m = signedIn && input.mySkills.length ? matchAgainst(pick.o, [...input.mySkills]) : null;
    steps.push({
      kind: "apply",
      verb: "Apply",
      title: pick.o.title,
      sub: [sample ? "Sample listing" : null, pick.o.employer?.name, pick.o.location]
        .filter(Boolean)
        .join(" · "),
      receipt: m
        ? `You list ${m.have.length} of the ${pick.o.skills.length} skills it asks for`
        : `Asks for ${shared.slice(0, 3).join(", ")}, which keep coming up in what you opened`,
      href: openingHref(pick.o),
      cta: sample ? "See live openings" : "See the opening",
      alt: [],
      sample,
    });
  } else
    steps.push({
      kind: "apply",
      verb: "Apply",
      title: `Browse ${focus.label} openings`,
      sub: "Nothing new asks for it right now.",
      receipt: `You have already opened every opening that asks for ${focus.label}`,
      href: "/jobs",
      cta: "See open jobs",
      alt: [{ href: "/internships", label: "See internships" }],
      sample: false,
    });

  return { status: "ready", tags: recurring.slice(0, 4), focus, steps, held: focus.held };
}

/* ── Recommended jobs ───────────────────────────────────────────────── */

export interface Because {
  title: string;
  shared: string[];
}

/**
 * Openings ordered by how many tags they share with what was viewed, with
 * everything already viewed removed. `because` names the newest view they
 * share a tag with; there is no score, so nothing here can read as a match.
 */
export function rankByViews(
  openings: ReadonlyArray<Opportunity>,
  views: ReadonlyArray<EntityView>,
): Array<{ o: Opportunity; because: Because | null }> {
  const universe = tagUniverse(openings);
  const labels = tagLabels(openings);
  const seen = viewedKeys(views);
  const viewTags = views.map((v) => ({ v, tags: tagsOfView(v, universe) }));
  return openings
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => !seen.has(o.slug.toLowerCase()))
    .map(({ o, i }) => {
      const tags = tagsOfOpening(o);
      let because: Because | null = null;
      let overlap = 0;
      for (const { v, tags: vt } of viewTags) {
        const shared = vt.filter((t) => tags.includes(t));
        overlap += shared.length;
        if (!because && shared.length)
          because = { title: v.title, shared: shared.slice(0, 2).map((t) => labelOf(labels, t)) };
      }
      return { o, i, because, overlap };
    })
    .sort(
      (a, b) =>
        Number(isSampleOpening(a.o)) - Number(isSampleOpening(b.o)) ||
        b.overlap - a.overlap ||
        a.i - b.i,
    )
    .map(({ o, because }) => ({ o, because }));
}
