import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Target,
  Eye,
  Compass,
  GraduationCap,
  Briefcase,
  Users,
  BadgeCheck,
  Search,
  MessageSquare,
  ShieldCheck,
  IndianRupee,
  MapPin,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { useAuth } from "@/context/AuthContext";
import { CareerIllustration, LearningPathIllustration } from "@/components/Illustrations";
import { openSarthi } from "@/components/AIAssistant";
import { stats } from "@/data/mock";

const TITLE = "About Us — our mission, vision and why this platform exists | स्वYAM";
const DESC =
  "स्वYAM connects learners across India with vocational training, internships, mentors and real jobs. Read our mission, our vision, and what you can do on the platform.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AboutPage,
});

/* ── What users can do ──────────────────────────────────────────── */
const capabilities = [
  {
    icon: GraduationCap,
    title: "Learn a skill",
    body: "Browse courses from verified institutes, many of them free, filtered by category, mode and difficulty.",
    to: "/courses",
    cta: "Browse courses",
  },
  {
    icon: Compass,
    title: "Explore skill tracks",
    body: "A curated library across programming, AI, design, business and soft skills, each with a difficulty level and the courses that teach it.",
    to: "/skills",
    cta: "See the library",
  },
  {
    icon: Briefcase,
    title: "Find real work",
    body: "Part-time shifts near home, freelance briefs, and full-time salaried roles — with transparent pay, honest timings and no placement fee.",
    to: "/jobs",
    cta: "View jobs",
  },
  {
    icon: BadgeCheck,
    title: "Take an internship",
    body: "Paid and credit-eligible placements with real teams, listing stipend, duration, work mode and the skills each one expects up front.",
    to: "/internships",
    cta: "View internships",
  },
  {
    icon: MessageSquare,
    title: "Ask Sarthi",
    body: "Describe what you know and where you want to go. Sarthi, our AI assistant, returns a shortlist with reasons rather than a wall of buzzwords.",
    action: "sarthi" as const,
    cta: "Ask Sarthi",
  },
  {
    icon: Users,
    title: "Join the community",
    body: "Follow other learners in your trade, read how people actually got hired, and ask the questions you would rather not ask an employer.",
    to: "/community",
    cta: "Open community",
  },
];

/* ── Why the platform exists ────────────────────────────────────── */
const reasons = [
  {
    icon: Search,
    title: "Opportunity is scattered",
    body: "Course listings sit on one portal, apprenticeships on another, and most local jobs never leave a WhatsApp group. Searching for all three at once meant searching in four places.",
  },
  {
    icon: ShieldCheck,
    title: "Credentials were hard to read",
    body: "Employers could not tell which certificate meant competence. Aligning everything to a single national framework makes a certificate something a recruiter can actually act on.",
  },
  {
    icon: IndianRupee,
    title: "Cost blocked capable people",
    body: "Government funding for training exists, but the paperwork hid it. We surface which courses are free, which are subsidized, and what a scheme actually covers.",
  },
  {
    icon: MapPin,
    title: "Distance decided careers",
    body: "A learner in a district town had the same ability and a fraction of the access. Remote courses, online mentors and nearby part-time work close most of that gap.",
  },
];

function AboutPage() {
  const { profileId } = useAuth();
  const signedIn = Boolean(profileId);

  return (
    <div className="relative z-10">
      {/* ══ Hero ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-ink-line">
        <div className="ledger absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-saffron-50 blur-3xl"
          aria-hidden
        />
        <div className="container-x relative grid grid-cols-1 items-center gap-12 pb-20 pt-28 lg:grid-cols-[1fr_1fr] lg:pt-36">
          <div>
            <p className="kicker">About us</p>
            <h1 className="type-hero mt-4 font-display text-ink">
              Skill first.
              <span className="block text-saffron-500">Everything else follows.</span>
            </h1>
            <p className="type-lede mt-6 max-w-xl text-ink-soft">
              स्वYAM is one place to learn a trade, prove it with a certificate employers recognize,
              and find work that pays fairly — whether that is a full-time engineering role or a
              part-time shift ten minutes from your home.
            </p>
            {/*
             * Asking a signed-in member to "create a free account" is the
             * page telling them it has no idea who they are. They already
             * did the thing being sold, so the invitation becomes a door
             * back into their own work.
             */}
            <div className="mt-9 flex flex-wrap gap-3">
              {signedIn ? (
                <>
                  <Link to="/dashboard" className="btn-primary">
                    Go to your dashboard <ArrowRight size={17} aria-hidden />
                  </Link>
                  <Link to="/courses" className="btn-ghost">
                    Browse courses
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth" search={{ mode: "signup" }} className="btn-primary">
                    Create a free account <ArrowRight size={17} aria-hidden />
                  </Link>
                  <Link to="/courses" className="btn-ghost">
                    Browse courses
                  </Link>
                </>
              )}
            </div>
          </div>
          <CareerIllustration className="h-auto w-full" />
        </div>
      </section>

      {/* ══ Mission & vision ═══════════════════════════════════ */}
      <section className="border-b border-ink-line">
        <div className="container-x grid grid-cols-1 gap-6 py-16 lg:grid-cols-2">
          <Reveal>
            <article className="panel h-full p-8 lg:p-10">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-saffron-50 to-saffron-100 text-saffron-500">
                <Target size={22} aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl tracking-tight text-ink">Our mission</h2>
              <p className="mt-4 font-body text-base leading-relaxed text-ink-soft">
                To make practical skills the shortest honest route to a livelihood. We bring
                training, certification, mentorship and hiring into one place, so that a capable
                person is never held back by not knowing where to look, what a certificate is worth,
                or who is actually hiring this week.
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.1}>
            <article className="panel gradient-warm h-full p-8 lg:p-10">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper-light text-saffron-500 shadow-[var(--shadow-soft)]">
                <Eye size={22} aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl tracking-tight text-ink">Our vision</h2>
              <p className="mt-4 font-body text-base leading-relaxed text-ink-soft">
                An India where the question asked at a hiring table is what you can do, not which
                city you studied in or whose name is on your degree. We want every district to have
                the same access to training, mentors and employers that a metro already takes for
                granted.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ══ Numbers ════════════════════════════════════════════ */}
      <section className="border-b border-ink-line bg-paper-dim">
        <div className="container-x py-14">
          <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StaggerItem key={s.label}>
                <div className="panel h-full p-6">
                  <p className="font-display text-3xl leading-none text-ink">
                    {s.value >= 10000000
                      ? `${(s.value / 10000000).toFixed(1)}Cr`
                      : s.value >= 100000
                        ? `${(s.value / 100000).toFixed(0)}L`
                        : s.value.toLocaleString("en-IN")}
                    <span className="text-saffron-500">{s.suffix}</span>
                  </p>
                  <p className="mt-2 font-body text-sm text-ink-mute">{s.label}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══ What you can do ════════════════════════════════════ */}
      <section className="border-b border-ink-line">
        <div className="container-x py-16">
          <Reveal>
            <p className="kicker">On the platform</p>
            <h2 className="section-title mt-3">What you can do here</h2>
            <p className="type-lede mt-4 max-w-2xl text-ink-soft">
              Six things, all free to start, and none of them requiring you to pay a placement fee
              to anybody.
            </p>
          </Reveal>

          <Stagger className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <StaggerItem key={c.title}>
                <article className="card group flex h-full flex-col p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-saffron-50 to-saffron-100 text-saffron-500 transition-colors duration-300 group-hover:text-saffron-600">
                    <c.icon size={20} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg leading-tight tracking-tight text-ink">
                    {c.title}
                  </h3>
                  <p className="mt-2.5 flex-1 font-body text-sm leading-relaxed text-ink-soft">
                    {c.body}
                  </p>
                  {c.action === "sarthi" ? (
                    <button
                      type="button"
                      onClick={openSarthi}
                      className="link-sweep mt-5 inline-flex items-center gap-1.5 self-start font-body text-xs font-medium text-saffron-600"
                    >
                      {c.cta} <ArrowUpRight size={14} aria-hidden />
                    </button>
                  ) : (
                    <Link
                      to={c.to}
                      className="link-sweep mt-5 inline-flex items-center gap-1.5 self-start font-body text-xs font-medium text-saffron-600"
                    >
                      {c.cta} <ArrowUpRight size={14} aria-hidden />
                    </Link>
                  )}
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══ Why we exist ═══════════════════════════════════════ */}
      <section className="border-b border-ink-line bg-paper-dim">
        <div className="container-x grid grid-cols-1 gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <Reveal>
              <p className="kicker">Why we exist</p>
              <h2 className="section-title mt-3">Four gaps worth closing</h2>
              <p className="type-lede mt-5 max-w-md text-ink-soft">
                The talent was never the missing part. The infrastructure around it was.
              </p>
              <LearningPathIllustration className="mt-8 hidden h-auto w-full max-w-md lg:block" />
            </Reveal>
          </div>

          <Stagger className="space-y-5">
            {reasons.map((r, i) => (
              <StaggerItem key={r.title}>
                <article className="card flex gap-5 p-6">
                  <div className="shrink-0">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper-dim text-saffron-500">
                      <r.icon size={20} aria-hidden />
                    </span>
                    <p className="mt-2 text-center font-body text-[10px] font-semibold text-ink-mute">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-tight tracking-tight text-ink">
                      {r.title}
                    </h3>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">{r.body}</p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══ CTA ════════════════════════════════════════════════ */}
      <section>
        <div className="container-x py-16">
          <div className="gradient-ink rounded-3xl p-10 text-center shadow-[var(--shadow-float)] lg:p-14">
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-saffron-glow">
              {signedIn ? "You are already in." : "Two minutes. No fee. No catch."}
            </p>
            <h2 className="type-xl mt-4 font-display text-paper-light">
              {signedIn ? "Pick up where you left off." : "Start where you are."}
            </h2>
            <p className="mx-auto mt-5 max-w-xl font-body text-base leading-relaxed text-paper-light/70">
              {signedIn
                ? "Your courses, sessions and certificates are all on one page. Everything else on this site feeds into it."
                : "Create a free account, tell us what you already know, and we will show you the courses, internships and jobs that actually fit."}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {signedIn ? (
                <Link to="/dashboard" className="btn-primary">
                  Open my dashboard <ArrowRight size={17} aria-hidden />
                </Link>
              ) : (
                <Link to="/auth" search={{ mode: "signup" }} className="btn-primary">
                  Create my free account <ArrowRight size={17} aria-hidden />
                </Link>
              )}
              <Link to="/contact" className="btn-dark !border !border-paper-light/20">
                Contact the team
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
