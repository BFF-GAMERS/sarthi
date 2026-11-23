/**
 * Resolve a behaviour-log entity id against the real catalogue. An id that
 * cannot be resolved is dropped, never guessed: Recently Viewed and the hero's
 * "Continue where you left off" only ever point at something that exists.
 */
import { courses, isSampleOpening, type Course } from "@/data/mock";
import { skillCategories, type NicheSkill } from "@/data/topics";
import type { Opportunity } from "@/lib/opportunities";

export type EntityView =
  | { kind: "course"; id: string; title: string; sub: string; href: string; course: Course }
  | {
      kind: "job" | "internship";
      id: string;
      title: string;
      sub: string;
      href: string;
      opening: Opportunity;
    }
  | { kind: "skill"; id: string; title: string; sub: string; href: string; skill: NicheSkill };

const slugOf = (entityId: string): string =>
  entityId.slice(entityId.indexOf("_") + 1).toLowerCase();

const allSkills = skillCategories.flatMap((c) => c.skills);

export function resolveEntity(
  entityId: string,
  openings: ReadonlyArray<Opportunity>,
): EntityView | null {
  const slug = slugOf(entityId);
  switch (entityId.slice(0, 3)) {
    case "crs": {
      const c = courses.find((x) => x.id.toLowerCase() === slug);
      return c
        ? {
            kind: "course",
            id: c.id,
            title: c.title,
            sub: c.free ? "Free" : c.fees,
            href: `/courses/${c.id}`,
            course: c,
          }
        : null;
    }
    case "opp": {
      const o = openings.find((x) => x.slug.toLowerCase() === slug);
      if (!o) return null;
      const internship = o.kind === "internship";
      const list = internship ? "/internships" : "/jobs";
      return {
        kind: internship ? "internship" : "job",
        id: o.slug,
        title: o.title,
        sub: o.employer?.name ?? "",
        // A labelled sample has no detail page; it points at the list it belongs to.
        href: isSampleOpening(o) ? `${list}#sample-${o.slug}` : `${list}/${o.slug}`,
        opening: o,
      };
    }
    case "skl": {
      const s = allSkills.find((x) => x.id.toLowerCase() === slug);
      return s
        ? { kind: "skill", id: s.id, title: s.title, sub: s.level, href: "/skills", skill: s }
        : null;
    }
    default:
      return null;
  }
}
