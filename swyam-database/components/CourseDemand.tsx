import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase } from "lucide-react";
import { listOpportunities, payLine, type Opportunity } from "../lib/opportunities";
import type { Course } from "../data/mock";
import { useTx } from "../lib/i18n";

/**
 * "Is this course worth it for me?"
 *
 * The question anybody weighing ₹2,999 actually has, and the one a course
 * page never answers. This platform is unusual in being able to: it holds
 * the courses and it holds the openings employers posted, and an opening
 * lists the skills it wants. So the answer is a join, not an opinion.
 *
 * Two rules keep it honest.
 *
 * It shows the working. An opening appears here only because a skill it
 * asks for is named in this course's outcomes, curriculum or projects, and
 * that skill is printed on the row. A reader can check the claim rather than
 * trust a match score — which is also why there is no score.
 *
 * It says nothing rather than something encouraging. No overlap, no
 * section. A course with no matching opening is not a bad course, and
 * inventing "in demand!" for it would be the exact dishonesty that
 * `db/011_only_real_openings.sql` was written to end.
 */

interface Hit {
  opportunity: Opportunity;
  /** The skills this course names that the opening asked for. */
  matched: string[];
}

export default function CourseDemand({ course }: { course: Course }) {
  const tx = useTx();

  const openings = useQuery({
    queryKey: ["opportunities", "all"],
    queryFn: () => listOpportunities(),
    staleTime: 5 * 60_000,
  });

  const { hits, total } = useMemo(() => {
    const all = openings.data ?? [];
    /*
     * Everything this course says it teaches, as one lowercase string:
     * the title, what you will be able to do, every module and topic, and
     * the projects. Matching against the whole of it rather than a skills
     * field is deliberate — a course has no skills column, and its syllabus
     * is the most truthful statement of what it covers.
     */
    const haystack = [
      course.title,
      course.category,
      ...(course.outcomes ?? []),
      ...(course.projects ?? []),
      ...(course.curriculum ?? []).flatMap((m) => [m.module, ...m.topics]),
    ]
      .join(" ")
      .toLowerCase();

    const out: Hit[] = [];
    for (const o of all) {
      const matched = (o.skills ?? []).filter((s) => {
        const k = s.trim().toLowerCase();
        // Two characters or fewer matches half the alphabet by accident.
        return k.length > 2 && haystack.includes(k);
      });
      if (matched.length > 0) out.push({ opportunity: o, matched });
    }
    out.sort((a, b) => b.matched.length - a.matched.length);
    return { hits: out, total: all.length };
  }, [openings.data, course]);

  if (hits.length === 0) return null;

  return (
    <section aria-labelledby="demand-title">
      <h2 id="demand-title" className="flex items-center gap-2 font-display text-2xl text-ink">
        <Briefcase size={19} className="text-saffron-500" aria-hidden />
        {tx("Who is hiring for this")}
      </h2>
      <p className="mt-2 max-w-2xl font-body text-[14px] leading-relaxed text-ink-soft">
        {/* The verb agrees with the count, not the total: "1 of the 5
            openings asks", "2 of the 5 openings ask". */}
        {`${hits.length} ${tx("of the")} ${total} ${
          total === 1 ? tx("opening") : tx("openings")
        } ${tx("on स्वYAM")} ${hits.length === 1 ? tx("asks") : tx("ask")} ${tx(
          "for something this course teaches. The skill that matched is named on each one.",
        )}`}
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {hits.map(({ opportunity: o, matched }) => (
          <li key={o.id}>
            <Link
              to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
              params={{ id: o.slug }}
              className="card-flat flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-body text-[14.5px] font-semibold text-ink">
                  {o.title}
                </span>
                <span className="block font-body text-[12.5px] text-ink-mute">
                  {o.employer?.name ?? tx("Employer not named")}
                  {o.location ? ` · ${o.location}` : ""}
                </span>
              </span>

              {/* The evidence, not a percentage. */}
              <span className="flex flex-wrap gap-1.5">
                {matched.slice(0, 3).map((s) => (
                  <span key={s} className="chip !py-0.5 !text-[11px]">
                    {s}
                  </span>
                ))}
              </span>

              <span className="font-mono text-[12.5px] tabular-nums text-ink">{payLine(o)}</span>
              <ArrowRight size={15} className="shrink-0 text-ink-mute" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-3 font-body text-[12px] leading-relaxed text-ink-mute">
        {tx(
          "Finishing a course is not an offer of work. These are openings that were live when this page loaded, and the employer decides.",
        )}
      </p>
    </section>
  );
}
