import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Portal from "./Portal";
import { useTx } from "../lib/i18n";
import { useProfileType } from "../lib/profile-type";
import { useAuth } from "../context/AuthContext";
import type { ProfileType } from "../lib/profile-type";

/**
 * The guided tour.
 *
 * Not a popup on every screen, and not a video. One region of the page is
 * lit at a time, with a sentence saying what it is for, and Back / Next /
 * Skip on every step. It never blocks navigation: the dimmed area is
 * click-through to nothing, the tour is dismissible with Escape, and the
 * step it reached is remembered so a person who leaves halfway is not
 * started again from the beginning.
 *
 * A step whose element is not on the page is skipped rather than pointing at
 * an empty rectangle — which is what happens when a school student takes the
 * tour and the job panels are not rendered for them at all.
 *
 * Anything that wants to be tourable marks itself with `data-tour="id"`.
 */

const KEY = "swayam-tour";

interface TourState {
  /** Tours finished or skipped, by id. */
  done: string[];
}

const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

function read(): TourState {
  if (typeof localStorage === "undefined") return { done: [] };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{"done":[]}') as TourState;
    return Array.isArray(v.done) ? v : { done: [] };
  } catch {
    return { done: [] };
  }
}

function write(s: TourState) {
  try {
    localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* the tour will simply offer itself again */
  }
  bump();
}

/* A tiny store, so `startTour()` can be called from anywhere — the end of
   onboarding, the Help section of Settings — without a context. */
let running = false;
/** Which steps to run; null means the member's own dashboard tour. */
let variant: "home" | null = null;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => running;

/** Start (or restart) the tour for the current page. `home` is the first-visit walk-through. */
export function startTour(which: "home" | null = null): void {
  variant = which;
  running = true;
  bump();
}

export function stopTour(): void {
  running = false;
  bump();
}

export function hasSeenTour(id: string): boolean {
  return read().done.includes(id);
}

export function markTourSeen(id: string): void {
  const s = read();
  if (!s.done.includes(id)) write({ done: [...s.done, id] });
}

/** Forget every tour, so Settings can offer to run them again. */
export function resetTours(): void {
  write({ done: [] });
}

interface Step {
  /** The `data-tour` attribute to light up. */
  target: string;
  title: string;
  body: string;
}

/**
 * What each kind of member is shown, in the order the work happens.
 *
 * Kept short on purpose: four stops is a tour, ten is a manual.
 */
const STEPS: Record<ProfileType | "default" | "home", Step[]> = {
  /* Works logged out: what the site is for, in the order someone would use it. */
  home: [
    {
      target: "home-search",
      title: "Start with what you want",
      body: "Type a skill, a course or a job, and see what is here.",
    },
    {
      target: "home-courses",
      title: "Pick a course",
      body: "Half of them are free. Each one ends in a test, and passing earns a certificate.",
    },
    {
      target: "home-jobs",
      title: "Apply to real openings",
      body: "We check every opening listed here before it goes up.",
    },
    {
      target: "home-skillswap",
      title: "Teach and learn with people",
      body: "On SkillSwap you can be a trainer, a learner or both, over live video.",
    },
    {
      target: "home-sarthi",
      title: "Stuck? Ask Sarthi",
      body: "Type or speak a question at any time, on any page.",
    },
  ],
  school: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "One thing to do next, chosen from your own plan and progress. It changes as you work.",
    },
    {
      target: "plan",
      title: "Your week",
      body: "The blocks your coach laid out. Tick one off when you finish it — that is what fills this in.",
    },
    {
      target: "nav",
      title: "Your sections",
      body: "Study plan, practice, careers and beginner courses. Nothing here is about jobs yet.",
    },
    {
      target: "profile",
      title: "What is still missing",
      body: "Each line says what it changes. None of it is required to use the site.",
    },
  ],
  college: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "The next move on your roadmap, with how long it takes.",
    },
    {
      target: "plan",
      title: "Your roadmap",
      body: "Degree, then the skills, the project and the internships that follow it.",
    },
    {
      target: "match",
      title: "An internship to aim at",
      body: "Matched against the skills on your passport, with the reason printed under it.",
    },
    {
      target: "profile",
      title: "What is still missing",
      body: "Matching runs on these. Each line says what filling it in changes.",
    },
  ],
  jobseeker: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "The single most useful thing you can do right now, and why.",
    },
    {
      target: "applications",
      title: "Every application, dated",
      body: "Applied, viewed, shortlisted, interview, decision — each step is recorded when the employer takes it.",
    },
    {
      target: "match",
      title: "Your closest match",
      body: "Scored against your skills. The line underneath says exactly why it is here.",
    },
    {
      target: "profile",
      title: "What employers see",
      body: "Your passport is what goes with every application. This is what is still missing from it.",
    },
  ],
  professional: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "The single most useful thing you can do right now, and why.",
    },
    {
      target: "applications",
      title: "Every application, dated",
      body: "Applied, viewed, shortlisted, interview, decision — each step is recorded when the employer takes it.",
    },
    {
      target: "match",
      title: "Your closest match",
      body: "Scored against your skills. The line underneath says exactly why it is here.",
    },
    {
      target: "profile",
      title: "What employers see",
      body: "Your passport is what goes with every application. This is what is still missing from it.",
    },
  ],
  recruiter: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "The next thing that moves a hire forward — usually somebody waiting on you.",
    },
    {
      target: "pipeline",
      title: "Your pipeline",
      body: "Counted from your own openings and applications. Nothing here is an estimate.",
    },
    {
      target: "candidates",
      title: "Moving a candidate",
      body: "The stage is a control. Every change is dated and the candidate is told, with your note.",
    },
  ],
  institute: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "The next thing that gets a course in front of learners.",
    },
    {
      target: "courses",
      title: "Your courses",
      body: "Enrollments are counted by the database as they happen. Drafts are invisible to learners.",
    },
  ],
  default: [
    {
      target: "nba",
      title: "Start here, every time",
      body: "One thing to do next, chosen from what your account actually holds.",
    },
    {
      target: "nav",
      title: "Your sections",
      body: "Named for what they do. Everything else is in the menu.",
    },
  ],
};

export default function Tour() {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const type = useProfileType(user?.email ?? "", user?.role ?? "student", profileId);
  const active = useSyncExternalStore(subscribe, snapshot, () => false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const tourId = variant ?? type ?? "default";
  const steps = STEPS[tourId] ?? STEPS.default;

  // Only steps whose element is actually on this page. A school student never
  // sees the applications panel, and a tour that points at nothing is worse
  // than no tour.
  const [present, setPresent] = useState<Step[]>([]);
  useEffect(() => {
    if (!active) return;
    // Present *and* visible: two elements can carry the same marker — the
    // rail on a laptop and the bottom bar on a phone — and the hidden one
    // would otherwise win and light up a rectangle of nothing.
    const visible = (t: string) =>
      [...document.querySelectorAll(`[data-tour="${t}"]`)].some(
        (el) => (el as HTMLElement).getBoundingClientRect().width > 0,
      );
    const found = steps.filter((s) => visible(s.target));
    setPresent(found);
    setIndex(0);
  }, [active, steps]);

  const step = present[index];

  // Follow the element: scroll it into view, then measure it. Re-measured on
  // resize and scroll so the spotlight cannot drift off its target.
  useEffect(() => {
    if (!active || !step) return;
    const el = [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find(
      (e) => (e as HTMLElement).getBoundingClientRect().width > 0,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const measure = () => setRect(el.getBoundingClientRect());
    const timer = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step]);

  const end = () => {
    markTourSeen(tourId);
    stopTour();
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, present.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!active || !step) return null;

  const last = index === present.length - 1;
  const pad = 8;
  const box = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: rect.height + pad * 2,
      }
    : null;

  // The card goes under the lit area, unless that would run off the screen.
  const below = box ? box.top + box.height + 12 : 120;
  const cardTop = box && below + 200 > window.innerHeight ? Math.max(12, box.top - 200) : below;

  return (
    <Portal>
      {/* The dimming is one element with a hole cut in it by a huge shadow,
          so there is nothing to click through and no four-rectangle seam. */}
      <div
        className="fixed inset-0 z-[110]"
        role="dialog"
        aria-modal="true"
        aria-label={tx("Tour")}
      >
        {/* Clear on purpose: the spotlight's own shadow does the dimming. A fill here would also
            cover the hole, and --color-ink is bone-white in the dark register. */}
        <div className={`absolute inset-0 ${box ? "" : "bg-black/60"}`} onClick={end} aria-hidden />
        {box && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-2xl ring-2 ring-saffron-400 transition-all duration-300"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.68)",
            }}
          />
        )}

        <div
          className="absolute left-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-ink-line bg-paper-light p-4 shadow-[var(--shadow-float)] transition-all duration-300"
          style={{ top: cardTop }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-[17px] leading-tight text-ink">{tx(step.title)}</p>
            <button
              type="button"
              onClick={end}
              aria-label={tx("Skip the tour")}
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-paper-dim hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-soft">
            {tx(step.body)}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums text-ink-mute">
              {index + 1}/{present.length}
            </span>
            <span className="flex-1" />
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="btn-ghost !px-3 !py-2 !text-[11px]"
              >
                <ArrowLeft size={12} aria-hidden /> {tx("Back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? end() : setIndex(index + 1))}
              className="btn-primary !px-3 !py-2 !text-[11px]"
            >
              {last ? tx("Done") : tx("Next")}
              {!last && <ArrowRight size={12} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
