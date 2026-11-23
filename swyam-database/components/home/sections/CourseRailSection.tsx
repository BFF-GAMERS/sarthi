import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { CourseCard } from "@/components/Cards";
import { courses } from "@/data/mock";
import { useTx } from "@/lib/i18n";
import { track } from "@/evolution/runtime/tracker/track";
import { EV } from "@/evolution/config/ids";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";

/* Six tiles as always; compact trims to three, research widens to the display limit. */
const railLimit = (p: SectionProps): number =>
  p.variant === "compact" ? 3 : Math.max(6, p.display.itemsPerSection);

export default function CourseRailSection(props: SectionProps) {
  const tx = useTx();
  const mark = sectionClick(props);
  const [onlyFree, setOnlyFree] = useState(false);
  const shown = useMemo(() => (onlyFree ? courses.filter((c) => c.free) : courses), [onlyFree]);
  return (
    <section className="border-y border-ink-line bg-paper-light/60 py-20 lg:py-24">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="kicker">{tx("Trending now")}</p>
              <h2 className="section-title mt-3">{tx("Courses that get you hired")}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {props.display.showCompare && (
                <Link to="/courses/compare" className="btn-ghost" onClick={mark}>
                  {tx("Compare courses")}
                </Link>
              )}
              <Link to="/courses" className="btn-ghost" onClick={mark}>
                {tx("All courses")} <ArrowUpRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>
        {props.display.showFilters && (
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={tx("Filter courses")}>
            {([false, true] as const).map((free) => (
              <button
                key={String(free)}
                type="button"
                aria-pressed={onlyFree === free}
                onClick={() => {
                  setOnlyFree(free);
                  track(EV.FILTER_USED, { surface: "home-courses", filter: free ? "free" : "all" });
                }}
                className={`chip ${onlyFree === free ? "!bg-saffron-50 !text-saffron-700" : ""}`}
              >
                {free ? tx("Free") : tx("All")}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        data-tour="home-courses"
        className="container-x mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.slice(0, railLimit(props)).map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
}
