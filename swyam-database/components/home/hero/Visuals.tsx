/**
 * The hero's right-hand visual, one per state. Every visual is drawn from the product's own parts
 * (cards, chips, rings), sits on the same ground and the same 5:4.4 box as the Solar PV plate, so
 * swapping state never moves the layout. The figures are illustrative and each visual is one image
 * for assistive tech: nobody is read a fake progress bar. Only the newest real thing the visitor
 * looked at (`featured`) replaces the sample title.
 */
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Check,
  MessagesSquare,
  Play,
  Repeat,
} from "lucide-react";
import SkillPlate from "@/components/SkillPlate";
import { useTx } from "@/lib/i18n";
import type { EvolutionState } from "@/evolution/types";
import { HERO_VISUAL, type HeroVisualKind } from "./model";

export interface Featured {
  title: string;
  sub: string;
}
export interface VisualProps {
  featured: Featured | null;
}

const CARD = "absolute rounded-[1.4rem] border border-ink-line bg-paper-light";

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      data-hero-visual-kind
      className="relative mx-auto aspect-[5/4.4] w-full max-w-[34rem] select-none"
    >
      <div
        aria-hidden
        className="absolute inset-[6%]"
        style={{
          backgroundColor: "var(--plate-ground)",
          borderRadius: "var(--plate-radius)",
          backgroundImage:
            "radial-gradient(40% 50% at 20% 20%, var(--plate-wash), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="ledger absolute inset-[6%] opacity-70"
        style={{ borderRadius: "var(--plate-radius)" }}
      />
      {children}
    </div>
  );
}

/** A tick, a ring or an empty dot: the one status mark every list in these visuals uses. */
function Mark({ state }: { state: "done" | "now" | "next" }) {
  const cls =
    state === "done"
      ? "bg-emeraldx-400 text-on-emerald"
      : state === "now"
        ? "border-2 border-saffron-500 text-saffron-500"
        : "border border-ink-line text-ink-mute";
  return (
    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${cls}`}>
      {state === "done" && <Check size={10} strokeWidth={3} aria-hidden />}
    </span>
  );
}

/* ── CAREER_FIRST: an application pipeline, drawn as a ticket ─────────────────────────────────── */
function Pipeline({ featured }: VisualProps) {
  const tx = useTx();
  const stages = [tx("Saved"), tx("Applied"), tx("Interview"), tx("Offer")];
  return (
    <Frame
      label={tx("Illustration: an application moving from saved to applied, interview and offer")}
    >
      <div
        className={`${CARD} animate-float-late left-[4%] top-[9%] w-[72%] shadow-[var(--shadow-raised)]`}
      >
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron-500 text-on-accent">
            <Briefcase size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
              {featured?.title ?? tx("Junior solar technician")}
            </p>
            <p className="truncate font-body text-[11.5px] text-ink-mute">
              {featured?.sub || tx("Apprenticeship · Jaipur")}
            </p>
          </div>
        </div>
        <div className="border-t border-dashed border-ink-line px-4 pb-4 pt-3 sm:px-5">
          <ol className="grid grid-cols-4 gap-1">
            {stages.map((s, i) => (
              <li key={s} className="min-w-0">
                <span className="mb-1.5 flex items-center">
                  <Mark state={i < 2 ? "done" : i === 2 ? "now" : "next"} />
                  <span
                    className={`ml-1 h-px flex-1 ${i < 3 ? "bg-ink-line" : "bg-transparent"}`}
                  />
                </span>
                <span
                  className={`block truncate font-body text-[10.5px] ${i <= 2 ? "text-ink" : "text-ink-mute"}`}
                >
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div
        className={`${CARD} animate-float bottom-[9%] right-[3%] w-[58%] p-4 shadow-[var(--shadow-float)] sm:p-5`}
      >
        <p className="kicker !text-[10px]">{tx("Ready to apply")}</p>
        <ul className="mt-2.5 space-y-2">
          {[tx("CV reviewed"), tx("Skill check passed"), tx("Certificate verified")].map((l, i) => (
            <li key={l} className="flex items-center gap-2.5 font-body text-[12px] text-ink">
              <Mark state={i < 2 ? "done" : "now"} />
              <span className="truncate">{l}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* ── LEARNING_FIRST: a progress ring and the next lesson ──────────────────────────────────────── */
const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

function Progress({ featured }: VisualProps) {
  const tx = useTx();
  const pct = 68;
  return (
    <Frame label={tx("Illustration: a course progress ring and the next lesson")}>
      <div
        className={`${CARD} animate-float-late left-[4%] top-[8%] grid w-[52%] place-items-center p-4 shadow-[var(--shadow-raised)] sm:p-5`}
      >
        <svg viewBox="0 0 100 100" className="w-[78%]" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={RING_R}
            fill="none"
            strokeWidth="9"
            className="stroke-paper-dim"
          />
          <circle
            cx="50"
            cy="50"
            r={RING_R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className="hero-ring-arc stroke-saffron-500"
            style={{
              strokeDasharray: RING_C,
              strokeDashoffset: RING_C * (1 - pct / 100),
              ["--ring-c" as string]: RING_C,
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
            }}
          />
          <text
            x="50"
            y="56"
            textAnchor="middle"
            className="fill-ink font-display"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {pct}%
          </text>
        </svg>
        <p className="mt-1 text-center font-body text-[11.5px] text-ink-mute">
          {tx("Module 3 of 4")}
        </p>
      </div>

      <div
        className={`${CARD} animate-float bottom-[9%] right-[3%] w-[64%] p-4 shadow-[var(--shadow-float)] sm:p-5`}
      >
        <p className="kicker !text-[10px]">{tx("Next lesson")}</p>
        <p className="mt-1.5 font-display text-[16px] font-semibold leading-tight text-ink">
          {featured?.title ?? tx("DC wiring and inverters")}
        </p>
        <p className="mt-0.5 font-body text-[11.5px] text-ink-mute">
          {featured?.sub || tx("Solar PV installer")}
        </p>
        <span className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-saffron-500 py-1.5 pl-2.5 pr-4 font-body text-[12px] font-semibold text-on-accent">
          <Play size={12} fill="currentColor" aria-hidden />
          {tx("Continue")}
        </span>
      </div>

      <div className="absolute right-[1%] top-[14%] hidden items-center gap-2 rounded-full border border-ink-line bg-paper-light py-1.5 pl-1.5 pr-4 shadow-[var(--shadow-raised)] sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emeraldx-400 text-on-emerald">
          <BadgeCheck size={16} aria-hidden />
        </span>
        <span className="font-body text-[12px] font-semibold text-ink">
          {tx("Certificate at 100%")}
        </span>
      </div>
    </Frame>
  );
}

/* ── SKILL_EXCHANGE_FIRST: a swap-match card ──────────────────────────────────────────────────── */
function Person({
  initial,
  role,
  skill,
  accent = false,
}: {
  initial: string;
  role: string;
  skill: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-semibold ${
          accent ? "bg-saffron-500 text-on-accent" : "border border-ink-line bg-paper-dim text-ink"
        }`}
      >
        {initial}
      </span>
      <div className="min-w-0">
        <p className="font-body text-[10.5px] uppercase tracking-[0.1em] text-ink-mute">{role}</p>
        <p className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
          {skill}
        </p>
      </div>
    </div>
  );
}

function Swap(_props: VisualProps) {
  const tx = useTx();
  return (
    <Frame label={tx("Illustration: two people matched to teach each other a skill")}>
      <div
        className={`${CARD} animate-float-late left-[4%] top-[8%] w-[66%] p-4 shadow-[var(--shadow-raised)] sm:p-5`}
      >
        <Person accent initial="A" role={tx("You teach")} skill={tx("Excel basics")} />
      </div>
      <span className="absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-saffron-500 text-on-accent shadow-[var(--shadow-float)]">
        <ArrowLeftRight size={20} aria-hidden />
      </span>
      <div
        className={`${CARD} animate-float bottom-[9%] right-[3%] w-[66%] p-4 shadow-[var(--shadow-float)] sm:p-5`}
      >
        <Person initial="R" role={tx("You learn")} skill={tx("Spoken English")} />
        <div className="mt-3.5 flex items-center justify-between rounded-xl bg-paper-dim px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-mute">
            {tx("Match")}
          </span>
          <span className="flex items-center gap-1 font-body text-[12px] font-semibold text-ink">
            <Repeat size={12} aria-hidden /> {tx("Both sides learn")}
          </span>
        </div>
      </div>
    </Frame>
  );
}

/* ── COMMUNITY_FIRST: a live thread ───────────────────────────────────────────────────────────── */
function Thread(_props: VisualProps) {
  const tx = useTx();
  return (
    <Frame label={tx("Illustration: a community thread with a question and replies")}>
      <div
        className={`${CARD} animate-float-late left-[4%] top-[8%] w-[74%] p-4 shadow-[var(--shadow-raised)] sm:p-5`}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-saffron-500 font-display text-[13px] font-semibold text-on-accent">
            S
          </span>
          <span className="font-body text-[11.5px] text-ink-mute">{tx("asked in Community")}</span>
        </div>
        <p className="mt-2.5 font-display text-[15px] font-semibold leading-snug text-ink">
          {tx("Which course helped you land your first job?")}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex -space-x-2" aria-hidden>
            {["K", "M", "P"].map((c) => (
              <span
                key={c}
                className="grid h-6 w-6 place-items-center rounded-full border-2 border-paper-light bg-paper-dim font-body text-[10px] font-semibold text-ink"
              >
                {c}
              </span>
            ))}
          </span>
          <span className="inline-flex items-center gap-1 font-body text-[11.5px] text-ink-mute">
            <MessagesSquare size={12} aria-hidden /> {tx("Replies")}
          </span>
        </div>
      </div>
      <div
        className={`${CARD} animate-float bottom-[9%] right-[3%] w-[62%] p-4 shadow-[var(--shadow-float)] sm:p-5`}
      >
        <p className="kicker !text-[10px]">{tx("Latest reply")}</p>
        <p className="mt-1.5 font-body text-[12.5px] leading-snug text-ink">
          {tx("The free one with a certificate. I finished it in a month.")}
        </p>
        <span className="mt-3 inline-block rounded-full bg-saffron-50 px-3 py-1 font-body text-[11.5px] font-semibold text-saffron-700">
          {tx("Join the thread")}
        </span>
      </div>
    </Frame>
  );
}

/* ── EXPLORER: four doors ─────────────────────────────────────────────────────────────────────── */
function Doors(_props: VisualProps) {
  const tx = useTx();
  const doors = [
    { Icon: BookOpen, label: tx("Courses") },
    { Icon: Briefcase, label: tx("Jobs") },
    { Icon: Repeat, label: tx("Skills") },
    { Icon: MessagesSquare, label: tx("Community") },
  ];
  return (
    <Frame label={tx("Illustration: four doors into Swayam: courses, jobs, skills and community")}>
      <div className="absolute inset-[12%] grid grid-cols-2 gap-3">
        {doors.map(({ Icon, label }, i) => (
          <div
            key={label}
            className={`flex flex-col justify-between rounded-[1.2rem] border border-ink-line bg-paper-light p-4 shadow-[var(--shadow-raised)] ${i % 2 ? "animate-float" : "animate-float-late"}`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-saffron-50 text-saffron-600">
              <Icon size={19} aria-hidden />
            </span>
            <span className="font-display text-[15px] font-semibold text-ink">{label}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Plate(_props: VisualProps) {
  return <SkillPlate />;
}

/** One entry per kind, so a new kind without a component fails the typecheck. */
export const VISUALS: Record<HeroVisualKind, ComponentType<VisualProps>> = {
  plate: Plate,
  pipeline: Pipeline,
  progress: Progress,
  swap: Swap,
  thread: Thread,
  doors: Doors,
};

export default function HeroVisual({
  state,
  featured,
}: {
  state: EvolutionState;
  featured: Featured | null;
}) {
  const Visual = VISUALS[HERO_VISUAL[state]];
  return <Visual featured={featured} />;
}
