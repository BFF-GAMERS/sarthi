import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Shapes, X } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { CourseCard } from "../components/Cards";
import { courses, COURSE_GROUPS, type Course, type CourseGroup } from "../data/mock";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import { TabsHint, tabKeyNav, useTabPlan } from "@/evolution/react/use-tab-plan";
import { SloganPlate } from "../components/Ornaments";
import { useListReturn } from "../components/return/useListReturn";
import { CompareTray, FilterControls, FilterSheet, SortSelect } from "../components/CourseFilters";
import {
  DEFAULT_FILTERS,
  applyFilters,
  applySort,
  countActive,
  type CourseFilters,
  type SortId,
} from "../lib/course-filters";

const TABS = ["All", ...COURSE_GROUPS] as const;
type Tab = (typeof TABS)[number];

/**
 * Skills people actually type, offered as one-tap chips.
 *
 * Filtered against the catalogue at load, so a chip can never lead to an
 * empty recommendation list: if no course mentions the term, the chip is
 * not offered.
 */
const SUGGESTION_CANDIDATES = [
  "Communication",
  "Python",
  "Design",
  "Marketing",
  "Plumbing",
  "Excel",
  "Video",
  "Sales",
  "Wiring",
  "Cooking",
  "React",
  "SQL",
  "Solar",
  "Electrical",
  "Accounting",
  "Nursing",
];

/**
 * Score a course against one skill term. Matching widens outward from the
 * title, so a direct hit always outranks an incidental mention in a module.
 */
function scoreCourse(course: Course, term: string): number {
  const t = term.toLowerCase().trim();
  if (!t) return 0;
  let score = 0;
  if (course.title.toLowerCase().includes(t)) score += 10;
  if (course.category.toLowerCase().includes(t)) score += 8;
  if (course.group.toLowerCase().includes(t)) score += 4;
  if (course.outcomes.some((o) => o.toLowerCase().includes(t))) score += 3;
  if (
    course.curriculum.some(
      (m) =>
        m.module.toLowerCase().includes(t) || m.topics.some((x) => x.toLowerCase().includes(t)),
    )
  )
    score += 3;
  if (course.overview.toLowerCase().includes(t)) score += 2;
  return score;
}

const SKILL_SUGGESTIONS = SUGGESTION_CANDIDATES.filter((s) =>
  courses.some((c) => scoreCourse(c, s) > 0),
).slice(0, 10);

const PAGE_SIZE = 12;

export default function Courses() {
  const tx = useTx();
  useListReturn("courses");
  const tabPlan = useTabPlan("courses", TABS);
  // The member's own pick wins; until they pick, the plan's default (All for guests) is shown.
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? tabPlan.defaultId;
  const [q, setQ] = useState("");
  // One weak LIST_SEARCHED per distinct committed term (blur or Enter), never the text itself.
  const searched = useRef("");
  const commitSearch = () => {
    const t = q.trim().toLowerCase();
    if (t && t !== searched.current) {
      searched.current = t;
      track(EV.LIST_SEARCHED, { surface: "courses" });
    }
  };
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [filters, setFilters] = useState<CourseFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortId>("match");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // The quick pills on the page write into the same filters as the sheet.
  const quick = (patch: Partial<CourseFilters>) => {
    for (const k of Object.keys(patch)) track(EV.LIST_FILTERED, { surface: "courses", filter: k });
    setFilters((f) => ({ ...f, ...patch }));
  };
  // A control edit reports WHICH filter moved (the field name), never its value.
  const onFilters = (next: CourseFilters) => {
    for (const k of Object.keys(next) as (keyof CourseFilters)[]) {
      if (JSON.stringify(next[k]) !== JSON.stringify(filters[k])) {
        track(EV.LIST_FILTERED, { surface: "courses", filter: k });
      }
    }
    setFilters(next);
  };
  const onSort = (next: SortId) => {
    if (next !== sort) track(EV.LIST_FILTERED, { surface: "courses", filter: "sort" });
    setSort(next);
  };
  const onTab = (next: Tab) => {
    if (next !== tab) track(EV.LIST_FILTERED, { surface: "courses", filter: "group" });
    setPicked(next);
    tabPlan.onSelect(next);
  };

  // A phone rarely has room for the whole filter row; the sheet takes
  // over below lg and the row is only rendered above it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setShowFilters(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const addSkill = (raw: string) => {
    const s = raw.trim();
    if (!s) return;
    track(EV.SKILL_SEARCHED, { surface: "courses" });
    setSkills((prev) =>
      prev.some((x) => x.toLowerCase() === s.toLowerCase()) ? prev : [...prev, s],
    );
    setSkillDraft("");
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const clearAll = () => {
    setQ("");
    setPicked("All");
    setFilters(DEFAULT_FILTERS);
    setSort("match");
    setSkills([]);
  };

  // Twelve at a time: forty cards at once is a wall, and a new filter starts from the top.
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  useEffect(() => setShownCount(PAGE_SIZE), [tab, q, filters, sort]);

  /** Courses matching the tab, the search box and the filters, in the chosen order. */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = courses.filter((c) => {
      if (tab !== "All" && c.group !== (tab as CourseGroup)) return false;
      if (!needle) return true;
      return (
        c.title.toLowerCase().includes(needle) ||
        c.category.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        c.trainer.name.toLowerCase().includes(needle)
      );
    });
    return applySort(applyFilters(base, filters), sort);
  }, [tab, q, filters, sort]);

  /** Recommendations are scored across the whole catalog, not just the tab. */
  const recommended = useMemo(() => {
    if (skills.length === 0) return [];
    return courses
      .map((c) => ({ course: c, score: skills.reduce((sum, s) => sum + scoreCourse(c, s), 0) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((r) => r.course);
  }, [skills]);

  const hasFilters =
    q !== "" || tab !== "All" || countActive(filters) > 0 || sort !== "match" || skills.length > 0;

  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <SloganPlate tone="saffron">{tx("Course catalog")}</SloganPlate>
        <h1 className="section-title mt-3">{tx("Learn a skill. Change your story.")}</h1>
        <p className="type-lede mt-4 max-w-2xl text-ink-soft">
          {courses.length} courses, half of them free. Every one ends in a test, not just a
          certificate for attending.
        </p>
      </Reveal>

      {/* ── Skill preferences ──────────────────────────────────── */}
      <Reveal delay={0.06} className="mt-8">
        <details className="panel p-4 sm:px-6" open={skills.length > 0}>
          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
            <Shapes size={16} className="text-saffron-500" aria-hidden />
            <span className="font-body text-[15px] font-semibold text-ink">
              {tx("Which skills do you already have?")}
            </span>
          </summary>
          <p className="mt-3 font-body text-sm text-ink-soft">
            {tx("Add a few, and we'll show you courses that build on what you already know.")}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSkill(skillDraft);
            }}
            className="mt-4 flex flex-wrap gap-2"
          >
            <input
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              placeholder={tx("e.g. Communication, Python, Plumbing\u2026")}
              aria-label={tx("Add a skill")}
              className="input max-w-sm flex-1"
            />
            <button
              type="submit"
              className="btn-dark !py-2.5 !text-xs"
              disabled={!skillDraft.trim()}
            >
              <Plus size={14} aria-hidden /> {tx("Add skill")}
            </button>
          </form>

          {/* Suggestion chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SKILL_SUGGESTIONS.filter(
              (s) => !skills.some((x) => x.toLowerCase() === s.toLowerCase()),
            ).map((s) => (
              <button key={s} onClick={() => addSkill(s)} className="chip hover:border-saffron-200">
                + {s}
              </button>
            ))}
          </div>

          {/* Selected skills */}
          {skills.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
              <span className="font-body text-[11px] font-medium uppercase tracking-wide text-ink-mute">
                {tx("Your skills")}
              </span>
              {skills.map((s) => (
                <button
                  key={s}
                  onClick={() => removeSkill(s)}
                  className="chip-accent"
                  aria-label={`Remove ${s}`}
                >
                  {s} <X size={11} aria-hidden />
                </button>
              ))}
            </div>
          )}
        </details>
      </Reveal>

      {/* ── Recommendations ────────────────────────────────────── */}
      <AnimatePresence>
        {recommended.length > 0 && (
          <motion.section
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            aria-live="polite"
          >
            <div className="pt-10">
              <h2 className="font-display text-xl tracking-tight text-ink">
                {tx("Recommended for you")}
              </h2>
              <p className="mt-1 font-body text-sm text-ink-mute">Based on {skills.join(", ")}.</p>
              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 card-grid">
                {recommended.map((c, i) => (
                  <div
                    key={`rec-${c.id}`}
                    className="contents"
                    onClickCapture={(e) => {
                      if ((e.target as Element).closest("a")) {
                        track(EV.RECOMMENDATION_CLICKED, {
                          surface: "courses",
                          rank: Math.min(i + 1, 8),
                          via: "static",
                        });
                      }
                    }}
                  >
                    <CourseCard course={c} />
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Category tabs ──────────────────────────────────────── */}
      <div className="mt-12">
        <div
          role="tablist"
          aria-label={tx("Course categories")}
          className="inline-flex max-w-full flex-wrap gap-1 rounded-[1.25rem] bg-paper-dim p-1.5"
        >
          {tabPlan.order.map((t) => {
            const selected = tab === t;
            const count =
              t === "All" ? courses.length : courses.filter((c) => c.group === t).length;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTab(t)}
                onKeyDown={(e) => tabKeyNav(e, tabPlan.order, onTab)}
                className={`relative rounded-full px-4 py-2 font-body text-[13px] font-semibold transition-colors duration-200 ${
                  selected ? "text-ink" : "text-ink-mute hover:text-ink"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="course-tab-pill"
                    className="absolute inset-0 rounded-full bg-paper-light shadow-[var(--shadow-soft)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">
                  {t}
                  <span className={selected ? "text-saffron-500" : "text-ink-mute"}>
                    {" "}
                    · {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {tabPlan.arranged && <TabsHint className="mt-2" />}

        {/* ── Search + quick filters ───────────────────────────── */}
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute"
              aria-hidden
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={commitSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSearch();
              }}
              placeholder={tx("Search courses or instructors\u2026")}
              className="input !pl-10"
              aria-label={tx("Search courses")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Two pills that answer most questions, then everything else behind Filters. */}
            <button
              onClick={() => quick({ price: filters.price === "free" ? "any" : "free" })}
              aria-pressed={filters.price === "free"}
              className={`filter-pill ${filters.price === "free" ? "evo-choice-on" : ""}`}
            >
              {tx("Free")}
            </button>
            <button
              onClick={() => quick({ mode: filters.mode === "Online" ? "any" : "Online" })}
              aria-pressed={filters.mode === "Online"}
              className={`filter-pill ${filters.mode === "Online" ? "evo-choice-on" : ""}`}
            >
              {tx("Online")}
            </button>
            {!showFilters && (
              <FilterSheet
                value={filters}
                onChange={onFilters}
                open={sheetOpen}
                onOpen={() => setSheetOpen(true)}
                onClose={() => setSheetOpen(false)}
                resultCount={filtered.length}
              />
            )}
            {showFilters && (
              <button
                onClick={() => setSheetOpen((v) => !v)}
                aria-expanded={sheetOpen}
                className={`filter-pill ${countActive(filters) > 0 ? "evo-choice-on" : ""}`}
              >
                {tx("Filters")}
                {countActive(filters) > 0 ? ` · ${countActive(filters)}` : ""}
              </button>
            )}
            <SortSelect value={sort} onChange={onSort} />
            {hasFilters && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 font-body text-xs font-medium text-saffron-600 hover:underline"
              >
                <X size={13} aria-hidden /> {tx("Clear")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* On a laptop the full set opens inline under the row. */}
      {showFilters && sheetOpen && (
        <div className="card mt-4 p-5">
          <FilterControls value={filters} onChange={onFilters} />
        </div>
      )}

      <p className="mt-6 font-body text-sm text-ink-mute" role="status" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "course" : "courses"} in {tab}
      </p>

      {/* Grid — keyed on the tab so switching animates as one block */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ y: 12 }}
          animate={{ y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 card-grid"
        >
          {filtered.slice(0, shownCount).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </motion.div>
      </AnimatePresence>

      <CompareTray />

      {filtered.length > shownCount && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShownCount((n) => n + PAGE_SIZE)}
          >
            {tx("Show more courses")} ({filtered.length - shownCount})
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="panel mt-8 p-12 text-center">
          <p className="font-display text-xl font-semibold tracking-tight">
            {tx("No courses match those filters")}
          </p>
          <button onClick={clearAll} className="btn-ghost mt-6">
            {tx("Clear all filters")}
          </button>
        </div>
      )}
    </div>
  );
}
