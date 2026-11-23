import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { payLine } from "@/lib/opportunities";
import { track } from "@/evolution/runtime/tracker/track";
import { EV } from "@/evolution/config/ids";
import { useTx } from "@/lib/i18n";
import { openingsOf, useOpenings } from "../data";
import { sectionClick } from "../track";
import { deadlineNote } from "./shared";
import { limitOf, type SectionProps } from "../types";

export default function HiringSection(props: SectionProps) {
  const tx = useTx();
  const mark = sectionClick(props);
  const [allJobs, setAllJobs] = useState(false);
  const openings = useOpenings();
  /* The section is headed "Open positions", and an internship is one. */
  /* Real openings only: the labeled samples are there for the Lab, and counted here they made
     five openings read as twenty-seven. */
  const every = useMemo(
    () => openingsOf(openings.data).filter((o) => !o.id.startsWith("sample:")),
    [openings.data],
  );
  /* Research density adds a kind filter; the list itself never loses an essential. */
  const [kind, setKind] = useState<"all" | "job" | "internship">("all");
  const allOpenings = useMemo(
    () => (kind === "all" ? every : every.filter((o) => o.kind === kind)),
    [every, kind],
  );
  const limit = limitOf(props);
  return (
    <section data-tour="home-jobs" className="container-x pb-20 lg:pb-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">{tx("Hiring this week")}</p>
            <h2 className="section-title mt-3">{tx("Open positions")}</h2>
          </div>
          <Link to="/jobs" className="btn-ghost" onClick={mark}>
            {tx("All jobs")} <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      </Reveal>

      {props.display.showFilters && every.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={tx("Filter openings")}>
          {(["all", "job", "internship"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                track(EV.FILTER_USED, { surface: "home-jobs", filter: k });
              }}
              className={`chip ${kind === k ? "!bg-saffron-50 !text-saffron-700" : ""}`}
            >
              {k === "all" ? tx("All") : k === "job" ? tx("Jobs") : tx("Internships")}
            </button>
          ))}
        </div>
      )}

      {openings.isLoading ? (
        <p className="mt-10 font-body text-sm text-ink-mute">{tx("Loading openings…")}</p>
      ) : allOpenings.length === 0 ? (
        /* An empty bordered box reads as a component that failed. Say it. */
        <p className="mt-10 font-body text-sm text-ink-mute">
          {tx("No openings are live right now. New roles appear here as employers post them.")}
        </p>
      ) : (
        <>
          <div className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-paper-light">
            {(allJobs ? allOpenings : allOpenings.slice(0, limit)).map((o, i) => (
              <Reveal key={o.id} delay={i * 0.04} y={16}>
                <Link
                  to={o.kind === "internship" ? "/internships/$id" : "/jobs/$id"}
                  params={{ id: o.slug }}
                  className="group grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-b border-ink-line px-5 py-5 transition-colors duration-200 last:border-b-0 hover:bg-paper sm:grid-cols-[3rem_1fr_auto_auto] sm:gap-x-6 sm:px-7"
                >
                  {o.employer?.logoUrl ? (
                    <img
                      src={o.employer.logoUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 rounded-xl border border-ink-line object-cover"
                    />
                  ) : (
                    /* Not every employer has a logo, and a broken image is
                       worse than none of one. Their initial does the job. */
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-ink-line bg-paper font-display text-[15px] font-semibold text-ink-soft">
                      {(o.employer?.name ?? "?").charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-[1.15rem] font-semibold leading-tight tracking-tight text-ink transition-colors group-hover:text-saffron-600 sm:text-[1.3rem]">
                      {o.title}
                    </h3>
                    <p className="mt-1 font-body text-[13px] text-ink-mute">
                      {[o.employer?.name, o.location, o.workMode, deadlineNote(o, tx)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="col-start-2 font-display text-[1.05rem] font-semibold leading-none text-ink sm:col-start-auto">
                    {payLine(o) ?? ""}
                  </span>
                  <span className="hidden h-10 w-10 place-items-center rounded-full border border-ink-line text-ink-soft transition-[color,background-color,border-color] duration-200 group-hover:border-transparent group-hover:bg-saffron-500 group-hover:text-white sm:grid">
                    <ArrowUpRight size={18} aria-hidden />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          {allOpenings.length > limit && (
            <button
              onClick={() => setAllJobs((v) => !v)}
              aria-expanded={allJobs}
              className="btn-ghost mt-5"
            >
              {allJobs
                ? tx("Show fewer")
                : `${tx("Show all")} ${allOpenings.length} ${tx("openings")}`}
              <ChevronDown
                size={16}
                aria-hidden
                className={allJobs ? "rotate-180 transition-transform" : "transition-transform"}
              />
            </button>
          )}
        </>
      )}
    </section>
  );
}
