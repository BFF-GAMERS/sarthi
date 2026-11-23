import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { courses } from "@/data/mock";
import { skillCategories } from "@/data/topics";
import { useTx } from "@/lib/i18n";
import { openingsOf, useOpenings } from "../data";
import type { SectionProps } from "../types";

/* The trades moving fastest. The counts that sit either side of these are
   built in the component, because they are read from the database. */
const tickerSkills: { label: string; count?: string; to: string }[] = skillCategories
  .flatMap((c) => c.skills)
  .filter((s) => s.demand === "Very high")
  .slice(0, 7)
  .map((s) => ({ label: s.title, to: "/skills" }));

export default function TrustStrip(_props: SectionProps) {
  const tx = useTx();
  const openings = useOpenings();
  const all = openingsOf(openings.data);
  const liveJobs = useMemo(() => all.filter((o) => o.kind === "job"), [all]);
  const liveInternships = useMemo(() => all.filter((o) => o.kind === "internship"), [all]);

  const tickerItems = useMemo(
    () => [
      { label: "Open apprenticeships", count: String(liveInternships.length), to: "/internships" },
      { label: "Live jobs", count: String(liveJobs.length), to: "/jobs" },
      ...tickerSkills,
      { label: "Courses", count: String(courses.length), to: "/courses" },
    ],
    [liveJobs.length, liveInternships.length],
  );

  return (
    <section
      className="border-y border-ink-line bg-paper-light/70 py-3.5"
      aria-label={tx("Live platform activity")}
    >
      <div className="flex overflow-hidden">
        <div className="flex shrink-0 animate-marquee items-center gap-8 pr-8">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className="flex min-h-11 shrink-0 items-center gap-8 transition-colors hover:text-saffron-600"
            >
              <span className="flex items-baseline gap-2">
                {item.count && (
                  <span className="font-display text-base font-bold tabular-nums text-saffron-500">
                    {item.count}
                  </span>
                )}
                <span className="font-body text-[14px] font-semibold text-ink">{item.label}</span>
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-ink-line" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
