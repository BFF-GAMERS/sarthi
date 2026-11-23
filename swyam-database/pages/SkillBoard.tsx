import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Bot, GraduationCap, PlayCircle, Search, Users } from "lucide-react";
import { Reveal } from "../components/Reveal";
import PillTabs from "../components/PillTabs";
import CountUp from "../components/CountUp";
import { coursesBySkill, skillBoard, type BoardCourse, type BoardSkill } from "../lib/board";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";
import { SloganPlate } from "../components/Ornaments";

/**
 * The skill board: every skill, and the ways through it.
 *
 * The board used to be a table of counts. A row said "4 trainers · 12 learners
 * · 3 courses" and then offered one button to the unfiltered catalogue — so
 * the numbers were true and completely unusable. Worse, a skill with nobody
 * certified to teach it was labelled "Needs a trainer" and left there, which
 * told the learner standing in front of it to give up.
 *
 * Every skill now has at least one route, because the AI mentor is always one
 * of them. Each row shows the three that exist — a course, a trainer, or on
 * your own — and each links to the actual thing rather than to a list.
 */

type Filter = "all" | "course" | "trainer" | "solo";

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "course", label: "Has a course" },
  { id: "trainer", label: "Has a trainer" },
  { id: "solo", label: "Only self-paced" },
];

export default function SkillBoard() {
  const tx = useTx();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  // A search is counted once it settles, never per keystroke, and never with its text.
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = window.setTimeout(() => track(EV.SKILL_SEARCHED, { surface: "board" }), 800);
    return () => window.clearTimeout(t);
  }, [q]);

  const board = useQuery({ queryKey: ["skill-board"], queryFn: () => skillBoard(300) });
  const skills = useMemo(() => board.data ?? [], [board.data]);

  // Second call rather than a wider RPC, because the RPC is shared with the
  // mentor page and the dashboard, which do not need the course rows.
  const courses = useQuery({
    queryKey: ["board-courses", skills.length],
    queryFn: () => coursesBySkill(skills.map((s) => s.id)),
    enabled: skills.length > 0,
  });
  const bySkill = courses.data ?? {};

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return skills.filter((s) => {
      if (needle && !`${s.name} ${s.category}`.toLowerCase().includes(needle)) return false;
      const hasCourse = (bySkill[s.id] ?? []).length > 0;
      if (filter === "course") return hasCourse;
      if (filter === "trainer") return s.trainers > 0;
      if (filter === "solo") return !hasCourse && s.trainers === 0;
      return true;
    });
  }, [skills, filter, q, bySkill]);

  const counts = useMemo(
    () => ({
      all: skills.length,
      course: skills.filter((s) => (bySkill[s.id] ?? []).length > 0).length,
      trainer: skills.filter((s) => s.trainers > 0).length,
      solo: skills.filter((s) => (bySkill[s.id] ?? []).length === 0 && s.trainers === 0).length,
    }),
    [skills, bySkill],
  );

  const categories = useMemo(() => {
    const map = new Map<string, BoardSkill[]>();
    for (const s of rows) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  return (
    <div className="container-x max-w-6xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="peacock">{tx("Skill board")}</SloganPlate>
        <h1 className="section-title mt-3">{tx("Every skill, and the way in")}</h1>
        <p className="type-lede mt-4 max-w-2xl">
          {tx(
            "Three ways to learn anything here: a course, somebody certified to teach it, or on your own with an AI mentor. The third one always exists, so no skill is ever a dead end.",
          )}
        </p>
      </Reveal>

      <Reveal className="mt-8">
        <dl className="grid grid-cols-2 gap-4 border-y border-ink-line py-5 sm:grid-cols-4">
          {[
            [tx("Skills tracked"), counts.all, tx("in the catalog")],
            [tx("With a course"), counts.course, tx("ready to enroll")],
            [tx("With a trainer"), counts.trainer, tx("certified to teach")],
            [tx("Self-paced only"), counts.solo, tx("AI mentor route")],
          ].map(([label, value, note]) => (
            <div key={String(label)}>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                {label}
              </dt>
              <dd className="mt-1 font-display text-2xl text-ink">
                <CountUp>{String(value)}</CountUp>
              </dd>
              <dd className="font-body text-[11px] text-ink-mute">{note}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <PillTabs
          tabs={FILTERS.map((f) => ({
            id: f.id,
            label: tx(f.label),
            count: counts[f.id],
          }))}
          selected={filter}
          onSelect={(id) => {
            if (id !== filter) track(EV.FILTER_USED, { surface: "board", filter: id });
            setFilter(id as Filter);
          }}
          layoutGroup="board"
          ariaLabel={tx("Filter skills")}
        />

        <div className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("Search a skill…")}
            aria-label={tx("Search a skill")}
            className="input !py-2 !pl-9 !text-[13px]"
          />
        </div>
      </div>

      {board.isLoading ? (
        <p className="mt-10 font-body text-sm text-ink-mute">{tx("Loading the board…")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-10 font-body text-sm text-ink-mute">{tx("Nothing matches that yet.")}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {categories.map(([category, list]) => (
            <section key={category}>
              <h2 className="flex items-baseline gap-3 border-b border-ink-line pb-2 font-display text-sm tracking-[0.12em] text-ink">
                {category}
                <span className="font-mono text-[11px] font-normal text-ink-mute">
                  {list.length}
                </span>
              </h2>

              <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {list.map((s, i) => (
                  <motion.li
                    key={s.id}
                    className="min-w-0"
                    initial={still ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: still ? 0 : 0.3,
                      delay: still ? 0 : Math.min(i, 10) * 0.02,
                    }}
                  >
                    <SkillRoutes skill={s} courses={bySkill[s.id] ?? []} />
                  </motion.li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One skill, and the routes through it.
 *
 * Ordered by what a learner should try first: a finished course beats a
 * trainer's calendar, and both beat studying alone. The last route is never
 * absent, which is the point of the redesign.
 */
function SkillRoutes({ skill, courses }: { skill: BoardSkill; courses: BoardCourse[] }) {
  const tx = useTx();
  const course = courses[0];
  const viewed = () =>
    track(EV.SKILL_VIEWED, { surface: "board" }, { entityId: entityId("skl", skill.slug) });

  return (
    <article className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight tracking-tight text-ink">
            {skill.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <GraduationCap size={11} aria-hidden />
              {skill.trainers} {skill.trainers === 1 ? tx("trainer") : tx("trainers")}
              {skill.masters > 0 && (
                <span className="text-saffron-600">
                  ({skill.masters} {tx("expert")})
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={11} aria-hidden />
              {skill.learners} {tx("want it")}
            </span>
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {/* 1 — a course, if one exists */}
        {course ? (
          <li>
            <Link
              to="/courses/$id"
              params={{ id: course.slug }}
              onClick={viewed}
              className="flex items-center gap-2.5 rounded-xl border border-ink-line p-2.5 transition-colors hover:border-saffron-200 hover:bg-saffron-50"
            >
              <PlayCircle size={15} className="shrink-0 text-saffron-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-[13px] font-medium text-ink">
                  {course.title}
                </span>
                <span className="block font-mono text-[10px] uppercase text-ink-mute">
                  {course.isFree ? tx("free") : `₹${Math.round(course.priceMinor / 100)}`} ·{" "}
                  {course.level}
                  {courses.length > 1 ? ` · +${courses.length - 1} ${tx("more")}` : ""}
                </span>
              </span>
              <ArrowRight size={13} className="shrink-0 text-ink-mute" aria-hidden />
            </Link>
          </li>
        ) : null}

        {/* 2 — a person, if anyone is certified */}
        {skill.trainers > 0 && (
          <li>
            <Link
              to="/skillswap"
              onClick={viewed}
              className="flex items-center gap-2.5 rounded-xl border border-ink-line p-2.5 transition-colors hover:border-saffron-200 hover:bg-saffron-50"
            >
              <GraduationCap size={15} className="shrink-0 text-saffron-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-body text-[13px] font-medium text-ink">
                  {tx("Learn it from a person")}
                </span>
                <span className="block font-mono text-[10px] uppercase text-ink-mute">
                  {skill.trainers} {skill.trainers === 1 ? tx("trainer") : tx("trainers")}{" "}
                  {tx("certified")}
                </span>
              </span>
              <ArrowRight size={13} className="shrink-0 text-ink-mute" aria-hidden />
            </Link>
          </li>
        )}

        {/* 3 — always available */}
        <li>
          <Link
            to="/mentor/$slug"
            params={{ slug: skill.slug }}
            onClick={viewed}
            className="flex items-center gap-2.5 rounded-xl border border-ink-line p-2.5 transition-colors hover:border-saffron-200 hover:bg-saffron-50"
          >
            <Bot size={15} className="shrink-0 text-saffron-500" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[13px] font-medium text-ink">
                {tx("Learn it on your own")}
              </span>
              <span className="block font-mono text-[10px] uppercase text-ink-mute">
                {course || skill.trainers > 0
                  ? tx("AI mentor")
                  : tx("AI mentor · the only route today")}
              </span>
            </span>
            <ArrowRight size={13} className="shrink-0 text-ink-mute" aria-hidden />
          </Link>
        </li>
      </ul>

      {skill.trainers === 0 && skill.learners > 0 && (
        <p className="mt-3 font-body text-[11px] leading-snug text-ink-mute">
          {skill.learners} {skill.learners === 1 ? tx("person wants") : tx("people want")}{" "}
          {tx("this and nobody can teach it yet.")}{" "}
          <Link to="/skillswap" className="underline underline-offset-2 hover:text-saffron-600">
            {tx("Get certified and teach it")}
          </Link>
        </p>
      )}
    </article>
  );
}
