import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  TrendingUp,
  BookOpen,
  Bot,
  Code,
  Coffee,
  Cpu,
  Braces,
  FileCode,
  Brain,
  Network,
  MessageSquareCode,
  ScanEye,
  Figma,
  Image,
  PenTool,
  LayoutTemplate,
  Megaphone,
  Handshake,
  IndianRupee,
  MessagesSquare,
  Flag,
  Users,
  Clock,
  Mic,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { LearningPathIllustration } from "@/components/Illustrations";
import { useCardExpand } from "@/lib/use-card-expand";
import { coursesForSkill } from "@/lib/skill-courses";
import { openSarthi } from "@/components/AIAssistant";
import { SloganPlate } from "../components/Ornaments";
import { useListReturn } from "../components/return/useListReturn";
import ReturnTick from "../components/return/ReturnTick";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";
import {
  skillCategories,
  totalSkillCount,
  type NicheSkill,
  type SkillCategory,
} from "@/data/topics";

const TITLE = "Skills library — Programming, AI, Design, Business & Soft Skills | स्वYAM";
const DESC =
  "A curated skills library across Programming, Artificial Intelligence, Design, Business and Soft Skills — each with a difficulty level, the competencies employers screen for, and the courses that teach them.";

/** Icon lookup, keyed by the `icon` field on each skill. */
const ICONS: Record<string, LucideIcon> = {
  code: Code,
  coffee: Coffee,
  cpu: Cpu,
  braces: Braces,
  "file-code": FileCode,
  brain: Brain,
  network: Network,
  "message-square-code": MessageSquareCode,
  "scan-eye": ScanEye,
  figma: Figma,
  image: Image,
  "pen-tool": PenTool,
  "layout-template": LayoutTemplate,
  megaphone: Megaphone,
  handshake: Handshake,
  "indian-rupee": IndianRupee,
  "messages-square": MessagesSquare,
  flag: Flag,
  users: Users,
  clock: Clock,
  mic: Mic,
  lightbulb: Lightbulb,
};

const LEVEL_STYLES: Record<NicheSkill["level"], string> = {
  Beginner: "border-emeraldx-400/30 bg-emeraldx-400/10 text-emeraldx-500",
  Intermediate: "border-saffron-200 bg-saffron-50 text-saffron-600",
  Advanced: "border-ink/20 bg-paper-dim text-ink",
};

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  useListReturn("skills");
  return (
    <div className="relative z-10">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-ink-line">
        <div className="ledger absolute inset-0" aria-hidden />
        <div className="container-x relative grid grid-cols-1 items-center gap-10 pb-16 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:pt-36">
          <div>
            <SloganPlate tone="peacock">
              {skillCategories.length} categories · {totalSkillCount} skills
            </SloganPlate>
            <h1 className="section-title mt-4">
              Pick a skill,
              <span className="block text-saffron-500">not a guess.</span>
            </h1>
            <p className="type-lede mt-6 max-w-xl text-ink-soft">
              A curated library across programming, AI, design, business and the human skills that
              decide promotions. Every entry lists its difficulty, what you will actually be able to
              do, and the courses that get you there.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/courses" className="btn-primary">
                Browse courses <ArrowUpRight size={16} aria-hidden />
              </Link>
              <button type="button" onClick={openSarthi} className="btn-ghost">
                <Sparkles size={15} aria-hidden /> Ask Sarthi
              </button>
            </div>
          </div>
          <LearningPathIllustration className="h-auto w-full" />
        </div>
      </section>

      {/* ── Category jump links ──────────────────────────────── */}
      <nav aria-label="Skill categories" className="border-b border-ink-line">
        <div className="container-x flex flex-wrap items-center gap-2 py-4">
          <span className="mr-1 flex items-center gap-1.5 font-body text-[11px] font-medium uppercase tracking-wide text-ink-mute">
            <ArrowDown size={12} aria-hidden /> Jump to
          </span>
          {skillCategories.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="filter-pill">
              {c.name}
            </a>
          ))}
        </div>
      </nav>

      {skillCategories.map((cat, i) => (
        <CategorySection key={cat.id} category={cat} index={i} />
      ))}

      {/* ── Mentor CTA ───────────────────────────────────────── */}
      <section className="border-t border-ink-line">
        <div className="container-x py-16">
          <div className="gradient-ink flex flex-wrap items-center justify-between gap-8 rounded-3xl p-10 shadow-[var(--shadow-float)]">
            <div>
              <h2 className="font-display text-3xl leading-tight tracking-tight text-paper-light">
                Not sure which one fits?
              </h2>
              <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-paper-light/70">
                Tell Sarthi what you already know and what you want to do next. You will get a
                shortlist with reasons, not a ranked list of buzzwords.
              </p>
            </div>
            <button type="button" onClick={openSarthi} className="btn-primary">
              Ask Sarthi <ArrowUpRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Salary values in the data that are phrases, reworded to read naturally under "Indicative salary". */
const SALARY_PHRASES: Record<string, string> = {
  "Unlocks senior bands": "Varies — opens senior roles",
};

function CategorySection({ category, index }: { category: SkillCategory; index: number }) {
  return (
    <section
      id={category.id}
      aria-labelledby={`${category.id}-heading`}
      className={`scroll-mt-32 ${index > 0 ? "border-t border-ink-line" : ""}`}
    >
      <div className="container-x py-14">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-ink-line pb-6">
            <div>
              <p className="kicker">
                {String(index + 1).padStart(2, "0")} · {category.skills.length} skills
              </p>
              <h2 id={`${category.id}-heading`} className="type-lg mt-3 font-display text-ink">
                {category.name}
              </h2>
            </div>
            <p className="max-w-md font-body text-sm leading-relaxed text-ink-soft">
              {category.tagline}
            </p>
          </div>
        </Reveal>

        <Stagger className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 card-grid">
          {category.skills.map((s) => (
            <StaggerItem key={s.id}>
              <SkillCard skill={s} category={category.name} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* Default state: icon, skill name, category only.
   Hover / keyboard focus reveals: description, difficulty, learning time,
   salary, competencies, recommended courses and the Learn More action.
   State is local to this component, so one card never affects another. */
function SkillCard({ skill, category }: { skill: NicheSkill; category: string }) {
  const Icon = ICONS[skill.icon] ?? Code;
  const { cardProps } = useCardExpand();
  const viewed = () =>
    track(EV.SKILL_VIEWED, { surface: "skills" }, { entityId: entityId("skl", skill.id) });
  // Scored against the real catalogue rather than the hand-written strings on
  // the skill, which named books and other people's courses.
  const taught = useMemo(() => coursesForSkill(skill), [skill]);

  return (
    <article
      {...cardProps}
      data-return-id={skill.id}
      className="card card-reveal group flex flex-col p-5"
    >
      <ReturnTick />
      {/* ── Default state ───────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-saffron-50 to-saffron-100 text-saffron-500 transition-colors duration-300 group-hover:text-saffron-600">
          <Icon size={22} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-snug text-ink transition-colors duration-200 group-hover:text-saffron-600">
            {skill.title}
          </h3>
          <p className="mt-1 font-body text-sm text-ink-mute">{category}</p>
        </div>
      </div>

      {/* ── Revealed on hover / focus ───────────────────────── */}
      <div className="hover-panel">
        <div className="hover-panel-inner">
          <p className="font-body text-sm leading-relaxed text-ink-soft">{skill.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-line pt-3">
            <div className="min-w-0">
              <dt className="font-body text-[10px] font-medium uppercase tracking-wide text-ink-mute">
                Difficulty
              </dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 font-body text-[11px] font-medium ${LEVEL_STYLES[skill.level]}`}
                >
                  {skill.level}
                </span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-body text-[10px] font-medium uppercase tracking-wide text-ink-mute">
                Learning time
              </dt>
              <dd className="mt-1 font-body text-sm text-ink">{skill.duration} to job-ready</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-body text-[10px] font-medium uppercase tracking-wide text-ink-mute">
                Indicative salary
              </dt>
              <dd className="mt-1 font-body text-sm text-saffron-600">
                {/* Our own estimate, not a survey: say so next to the figure, the
                    same way demand does. Non-figure values read as a phrase. */}
                {skill.salary.startsWith("₹") ? (
                  <>
                    {skill.salary} <span className="text-ink-mute">(our estimate)</span>
                  </>
                ) : (
                  (SALARY_PHRASES[skill.salary] ?? skill.salary)
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-body text-[10px] font-medium uppercase tracking-wide text-ink-mute">
                Demand
              </dt>
              <dd className="mt-1 inline-flex items-center gap-1.5 font-body text-sm text-ink">
                {/* Our own read, said as ours. The platform has no hiring
                    data to turn this into a measurement. */}
                <TrendingUp size={12} aria-hidden /> {skill.demand}{" "}
                <span className="text-ink-mute">(our estimate)</span>
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 font-body text-[10px] font-medium uppercase tracking-wide text-ink-mute">
              <BookOpen size={11} aria-hidden />
              {taught.length > 0 ? "Courses that teach it" : "No course covers this yet"}
            </p>

            {taught.length > 0 ? (
              <ul className="space-y-1.5">
                {taught.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/courses/$id"
                      params={{ id: c.id }}
                      onClick={viewed}
                      className="flex items-start gap-2 font-body text-sm leading-snug text-ink-soft transition-colors hover:text-saffron-600"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        {c.title}
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-ink-mute">
                          {c.free ? "free" : c.fees} · {c.duration}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body text-sm leading-snug text-ink-soft">
                Nobody has published a course for this yet. Your AI mentor will build the modules
                and guide you through them.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {taught[0] ? (
              <Link
                to="/courses/$id"
                params={{ id: taught[0].id }}
                onClick={viewed}
                className="btn-primary flex-1 justify-center !py-2.5 !text-xs"
              >
                Start this course <ArrowUpRight size={15} aria-hidden />
              </Link>
            ) : (
              <Link
                to="/mentor/$slug"
                params={{ slug: skill.id }}
                onClick={viewed}
                className="btn-primary flex-1 justify-center !py-2.5 !text-xs"
              >
                <Bot size={14} aria-hidden /> Learn it with AI
              </Link>
            )}
            {taught[0] && (
              <Link
                to="/mentor/$slug"
                params={{ slug: skill.id }}
                onClick={viewed}
                className="btn-ghost !px-3 !py-2.5 !text-xs"
                aria-label={`Learn ${skill.title} on your own with an AI mentor`}
              >
                <Bot size={14} aria-hidden /> On my own
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
