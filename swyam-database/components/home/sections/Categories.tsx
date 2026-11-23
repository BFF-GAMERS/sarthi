import { Link } from "@tanstack/react-router";
import { COURSE_GROUPS } from "@/data/mock";
import { skillCategories } from "@/data/topics";
import { useTx } from "@/lib/i18n";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";
import { SectionShell } from "./shared";

/** Every skill track and course group, one tap from where it lives. Public. */
export default function Categories(p: SectionProps) {
  const tx = useTx();
  const mark = sectionClick(p);
  return (
    <SectionShell
      p={p}
      kicker={tx("Discover")}
      title={tx("Browse by category")}
      seeAll={{ href: "/explore", label: tx("Explore everything") }}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skillCategories.map((c) => (
          <li key={c.id}>
            <Link to="/skills" onClick={mark} className="card block p-4">
              <span className="block font-display text-[1.05rem] font-semibold leading-tight text-ink">
                {c.name}
              </span>
              <span className="mt-1 block font-body text-[12.5px] text-ink-mute">
                {c.skills.length} {tx("skills")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label={tx("Course groups")}>
        {COURSE_GROUPS.map((g) => (
          <li key={g}>
            <Link
              to="/courses"
              onClick={mark}
              className="chip hover:bg-saffron-50 hover:text-saffron-700"
            >
              {g}
            </Link>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
