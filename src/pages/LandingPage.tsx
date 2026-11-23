import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, Gift, GraduationCap, Mic, PlayCircle, Presentation, Sigma, Target, Users } from "lucide-react";
import { getSubject, getChapter } from "../lib/content";
import { currentAccount } from "../lib/auth";
import type { ClassLevel } from "../data/curriculum";
import { useReveal } from "../lib/useReveal";

const FEATURED: [ClassLevel, string][] = [
  [10, "science"],
  [10, "mathematics"],
  [12, "physics"],
  [9, "science"],
  [12, "chemistry"],
  [11, "physics"],
];

const TEACHERS = ["Prashant Kirad · Next Toppers", "Shobhit Nirwan", "Ashu Sir · Science and Fun", "Physics Wallah", "Digraj Sir · SST", "Magnet Brains"];

const FEATURES = [
  { icon: PlayCircle, title: "Course player", text: "Every chapter is a module with India's most-watched lecture for it, right inside Swyam." },
  { icon: Mic, title: "Sarthi voice tutor", text: "Ask doubts by voice in Hindi, English or Hinglish and hear a natural answer back." },
  { icon: Sigma, title: "Numericals on the board", text: "Sarthi solves step by step on an animated blackboard and explains each line aloud." },
  { icon: Target, title: "Most-likely exam questions", text: "Chapter-wise questions with marks and hints, plus a quiz that finds your weak topics." },
  { icon: CalendarDays, title: "Study planner", text: "Give your exam date — get a day-by-day plan that revises weak topics first." },
  { icon: Gift, title: "SkillPoints & rewards", text: "Earn points for real learning and unlock mock tests, question banks and certificates." },
];

function thumb(cls: ClassLevel, subject: string): string | null {
  const s = getSubject(cls, subject);
  const id = s?.chapters.find((c) => c.lectures[0]?.youtubeId)?.lectures[0]?.youtubeId;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export default function LandingPage() {
  const acc = currentAccount();
  const start = acc ? "/dashboard" : "/login?mode=register&role=student";
  const hero = getChapter("c10-sci-03");
  const heroThumb = hero?.lectures[0]?.youtubeId ? `https://i.ytimg.com/vi/${hero.lectures[0].youtubeId}/hqdefault.jpg` : null;
  const teachersRef = useReveal<HTMLElement>();
  const featuredRef = useReveal<HTMLElement>();
  const featuresRef = useReveal<HTMLElement>();
  const rolesRef = useReveal<HTMLElement>();
  const ctaRef = useReveal<HTMLElement>();

  return (
    <>
      {/* ── hero ── */}
      <section className="hero-glow container-x pb-16 pt-10 lg:pb-24 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="chip-accent">Free forever · CBSE Class 8–12 · हिन्दी · English · Hinglish</span>
            <h1 className="type-hero hero-display anim-fade-up mt-6">
              India’s best teachers.
              <span className="text-gradient block">
                One free classroom.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg opacity-85">
              Full courses for every chapter — the most-watched lectures, clear notes, likely exam questions and quizzes — with Sarthi, an AI tutor you can talk to.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={start} className="btn-primary flex items-center gap-2 !px-6 !py-3">
                {acc ? "Go to my dashboard" : "Start learning free"} <ArrowRight size={18} />
              </Link>
              <Link to="/courses" className="btn-ghost !px-6 !py-3">
                Explore courses
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-4">
              {[
                ["244", "chapters"],
                ["5", "classes"],
                ["3", "languages"],
                ["₹0", "always"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="stat-figure !text-3xl">{n}</dt>
                  <dd className="text-sm text-[var(--color-ink-mute)]">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* product preview */}
          <div className="anim-scale-in relative mx-auto w-full max-w-lg" style={{ "--delay": "150ms" } as CSSProperties}>
            <div className="card overflow-hidden p-0">
              <div className="relative aspect-video bg-black">
                {heroThumb && <img src={heroThumb} alt="" className="h-full w-full object-cover" />}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-black shadow-lg">
                    <PlayCircle size={30} />
                  </span>
                </span>
              </div>
              <div className="p-4">
                <p className="kicker">Class 10 Science · Module 3</p>
                <p className="mt-1 font-semibold">{hero?.title ?? "Metals and Non-metals"}</p>
                <div className="progress-track mt-3">
                  <div className="progress-fill" style={{ width: "62%" }} />
                </div>
              </div>
            </div>

            <div className="card absolute -bottom-10 -left-4 hidden w-64 p-4 sm:block">
              <p className="kicker flex items-center gap-1">
                <Mic size={12} /> Sarthi
              </p>
              <p className="mt-2 text-sm">“Velocity mein direction bhi hoti hai — jaise auto North ki taraf 40 km/h…”</p>
            </div>

            <div className="board absolute -right-4 -top-8 hidden w-56 sm:block" aria-hidden>
              <div className="board-body !min-h-0 !gap-1 !p-3">
                <p className="chalk chalk-formula !text-sm" style={{ animationDuration: "1.2s" }}>
                  K = ½mv²
                </p>
                <p className="chalk !text-sm" style={{ animationDuration: "1.4s", animationDelay: "0.8s" }}>
                  = ½ × 5 × 4²
                </p>
                <p className="chalk chalk-answer !text-sm" style={{ animationDuration: "1s", animationDelay: "1.8s" }}>
                  K = 40 J
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── teachers strip ── */}
      <section ref={teachersRef} className="reveal border-y border-[var(--color-ink-line)] py-6">
        <div className="container-x flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <span className="kicker">Lectures from</span>
          {TEACHERS.map((t) => (
            <span key={t} className="font-semibold opacity-80">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── featured courses ── */}
      <section ref={featuredRef} className="reveal container-x py-[var(--section-y)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Popular courses</p>
            <h2 className="type-xl mt-2">Pick a subject, start in seconds</h2>
          </div>
          <Link to="/courses" className="btn-text">
            All courses →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED.map(([cls, sid], i) => {
            const s = getSubject(cls, sid);
            if (!s) return null;
            const t = thumb(cls, sid);
            return (
              <Link key={cls + sid} to={`/courses/${cls}/${sid}`} className="card anim-fade-up group flex h-full flex-col overflow-hidden p-0 no-underline" style={{ "--delay": `${i * 70}ms` } as CSSProperties}>
                <div className="aspect-video overflow-hidden bg-black">
                  {t && <img src={t} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <div className="p-5">
                  <p className="kicker">Class {cls}</p>
                  <h3 className="type-lg mt-1">{s.name}</h3>
                  <p className="mt-1 text-sm opacity-70">
                    {s.chapters.length} modules · Free
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── features ── */}
      <section ref={featuresRef} className="reveal container-x py-[var(--section-y)]">
        <p className="kicker">Everything a student needs</p>
        <h2 className="type-xl mt-2 max-w-2xl">Watch, understand, practise — and ask when you’re stuck.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="card anim-fade-up h-full p-6" style={{ "--delay": `${i * 70}ms` } as CSSProperties}>
              <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--color-saffron-50)", color: "var(--color-saffron-500)" }}>
                <Icon size={22} />
              </span>
              <h3 className="type-lg mt-4">{title}</h3>
              <p className="mt-2 opacity-80">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── roles ── */}
      <section ref={rolesRef} className="reveal container-x py-[var(--section-y)]">
        <p className="kicker">Made for the whole family</p>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            { icon: GraduationCap, t: "Students", d: "Courses, Sarthi, quizzes, planner and rewards.", to: "/login?mode=register&role=student" },
            { icon: Users, t: "Parents", d: "A simple read-only view of your child’s week.", to: "/login?mode=register&role=parent" },
            { icon: Presentation, t: "Teachers & volunteers", d: "Track a group, spot who needs help, assign revision.", to: "/login?mode=register&role=teacher" },
          ].map(({ icon: Icon, t, d, to }, i) => (
            <Link key={t} to={to} className="card anim-fade-up flex h-full flex-col gap-3 p-6 no-underline" style={{ "--delay": `${i * 70}ms` } as CSSProperties}>
              <Icon size={24} style={{ color: "var(--color-saffron-500)" }} />
              <h3 className="type-lg">{t}</h3>
              <p className="opacity-80">{d}</p>
              <span className="btn-text mt-auto">Join as {t.split(" ")[0].toLowerCase()} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── closing CTA ── */}
      <section ref={ctaRef} className="reveal container-x pb-20 pt-6">
        <div className="ink-block relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-8">
          <div className="halftone absolute inset-0 opacity-[0.07]" aria-hidden />
          <BookOpen className="relative mx-auto" size={32} />
          <h2 className="type-xl relative mt-4">Your next chapter starts now.</h2>
          <p className="relative mx-auto mt-3 max-w-xl opacity-80">Free for every student, in every corner of India.</p>
          <Link to={start} className="btn-primary relative mt-8 inline-flex items-center gap-2 !px-6 !py-3">
            {acc ? "Continue learning" : "Create free account"} <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
