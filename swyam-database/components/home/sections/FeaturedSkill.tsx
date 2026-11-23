import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarRange } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { skillCategories } from "@/data/topics";
import { useTx } from "@/lib/i18n";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";

/* The cover story: highest-demand skill in the first track. */
const featured = {
  ...skillCategories[0]!.skills[0]!,
  category: skillCategories[0]!.name,
};

export default function FeaturedSkill(props: SectionProps) {
  const tx = useTx();
  const mark = sectionClick(props);
  return (
    <section className="container-x pb-20 lg:pb-28">
      <Reveal>
        <div className="panel overflow-hidden lg:grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="gradient-warm relative flex flex-col justify-between p-7 sm:p-9 lg:p-11">
            <div className="ledger absolute inset-0 opacity-60" aria-hidden />
            <div className="relative">
              <span className="sticker inline-flex items-center gap-1.5">
                <CalendarRange size={12} aria-hidden /> {tx("Skill of the month")}
              </span>
              <p className="kicker mt-7">{featured.category}</p>
              <h2 className="type-lg mt-2 font-display text-ink">{featured.title}</h2>
            </div>
            <dl className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {[
                [tx("Level"), featured.level],
                [tx("Time to job-ready"), featured.duration],
                [tx("Demand (our estimate)"), featured.demand],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-paper-light/70 p-3.5">
                  <dt className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
                    {k}
                  </dt>
                  <dd className="mt-1 font-display text-[15px] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col justify-between p-7 sm:p-9 lg:p-11">
            <div>
              <p className="type-lede text-ink-soft">{featured.description}</p>

              <div className="mt-7">
                <p className="datum">{tx("What you will be able to do")}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {featured.competencies.map((c) => (
                    <li key={c} className="chip">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-7 flex items-center justify-between rounded-2xl bg-paper-dim px-5 py-4">
                <p className="datum">{tx("Typical salary")}</p>
                <p className="font-display text-2xl font-bold leading-none text-saffron-500">
                  {featured.salary}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/skills" className="btn-primary" onClick={mark}>
                {tx("Explore the skills library")} <ArrowUpRight size={16} aria-hidden />
              </Link>
              <Link to="/jobs" className="btn-ghost" onClick={mark}>
                {tx("See who is hiring")}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
      {props.variant !== "compact" && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label={tx("Skill categories")}>
          {skillCategories.map((c) => (
            <li key={c.id}>
              <Link
                to="/skills"
                className="chip hover:bg-saffron-50 hover:text-saffron-700"
                onClick={mark}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
