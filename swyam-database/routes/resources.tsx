import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock } from "lucide-react";
import { Reveal, Stagger, StaggerItem, ScaleImage } from "@/components/Reveal";
import { IkatPattern } from "@/components/Patterns";
import { SloganPlate } from "../components/Ornaments";

const TITLE = "The Knowledge Base — guides for the working learner | स्वYAM";
const DESC =
  "Long-form guides on certification, apprenticeships, pay negotiation and switching trades — written for people already at work.";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: KnowledgePage,
});

const SECTIONS = [
  { id: "why", label: "Why the certificate matters" },
  { id: "ladder", label: "Reading the NSQF ladder" },
  { id: "money", label: "What it should cost you" },
  { id: "proof", label: "Building proof of work" },
  { id: "ask", label: "Asking for the raise" },
];

/**
 * Where to go next, and every one of them real.
 *
 * These were three article cards -- photo, headline, reading time -- for
 * articles that do not exist and were not links. The reading time was the
 * tell: it promised a page nobody had written.
 */
const RELATED: Array<{
  id: string;
  kicker: string;
  title: string;
  note: string;
  to: string;
  image: string;
}> = [
  {
    id: "schemes",
    kicker: "Money",
    title: "What the government will actually pay for",
    note: "18 central schemes, in plain language, each linked to its own ministry page.",
    to: "/schemes",
    image:
      "https://images.unsplash.com/photo-1742934027823-7ab9021e470e?auto=format&fit=crop&w=800&q=70",
  },
  {
    id: "board",
    kicker: "Skills",
    title: "Can anyone here teach the trade you want?",
    note: "Every skill with its routes: a course, a certified trainer, or on your own with AI.",
    to: "/board",
    image:
      "https://images.unsplash.com/photo-1623303366639-0e330d7c3d9f?auto=format&fit=crop&w=800&q=70",
  },
  {
    id: "courses",
    kicker: "Start",
    title: "The courses themselves",
    note: "Most of them free, each ending in an assessment rather than a certificate of attendance.",
    to: "/courses",
    image:
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=70",
  },
];

function KnowledgePage() {
  const [active, setActive] = useState(SECTIONS[0]!.id);

  // Sticky index tracks the section currently under the masthead.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative z-10">
      {/* ══ MASTHEAD ═══════════════════════════════════════════ */}
      <section className="relative border-b border-ink-line">
        <div className="pointer-events-none absolute inset-0 text-ink" aria-hidden>
          <IkatPattern opacity={0.06} scale={56} />
        </div>
        <div className="container-x relative pb-12 pt-32 lg:pt-40">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SloganPlate tone="indigo">The Knowledge Base · Certification</SloganPlate>
            <span className="datum flex items-center gap-1.5">
              <Clock size={12} aria-hidden /> 4 min read
            </span>
          </div>

          <h1 className="type-xl mt-6 max-w-4xl font-display text-ink">
            Your certificate is a <span className="text-saffron-500">negotiating document.</span>{" "}
            Most people file it away.
          </h1>

          <p className="mt-7 max-w-2xl font-editorial text-2xl leading-snug text-ink-soft">
            An NSQF certificate is not a participation record. It is a claim about what you can do,
            assessed against a national standard — and it is worth money at exactly the moments most
            people forget to mention it.
          </p>
        </div>
      </section>

      {/* ══ LEAD IMAGE — full bleed, parallax scale ════════════ */}
      <ScaleImage
        src="https://images.unsplash.com/photo-1741591648726-125c0d39f2c8?auto=format&fit=crop&w=1800&q=70"
        alt="A technician commissioning equipment on a workshop floor"
        className="h-[46vh] max-h-[32rem] w-full border-b border-ink-line"
      />

      {/* ══ ARTICLE + STICKY INDEX ════════════════════════════ */}
      <div className="container-x grid grid-cols-1 gap-12 py-16 lg:grid-cols-[1fr_17rem] lg:gap-16">
        <article className="max-w-[46rem]">
          <p className="dropcap font-body text-lg leading-[1.75] text-ink">
            There is a moment, somewhere between finishing a course and starting the next job, when
            a certificate stops being a piece of paper and becomes leverage. Most people miss it.
            They complete the assessment, collect the credential, put it in a folder, and then walk
            into a salary conversation talking about how hard they work — which is the one thing
            every candidate says.
          </p>

          <p className="mt-6 font-body text-lg leading-[1.75] text-ink-soft">
            The people who do well say something narrower and stranger: they name a level. They say
            they hold a Level 5 certification in a trade, describe the two competencies that level
            requires, and let the employer do the arithmetic. That is not confidence. It is just
            knowing what the document says.
          </p>

          <Section id="why" title="Why the certificate matters">
            <p>
              Before the national framework, a hiring manager in Pune had no way to read a training
              certificate issued in Guwahati. Every institute graded on its own scale, so employers
              defaulted to the only signal they trusted — a degree, or a referral. Skilled people
              without either simply did not surface.
            </p>
            <p>
              The framework fixed the reading problem, not the training problem. Its value is that a
              stranger can now decode your credential at a glance. That is the whole point, and it
              is why the level number matters more than the institute name.
            </p>
          </Section>

          <Section id="ladder" title="Reading the NSQF ladder">
            <p>
              Ten levels, each defined by what you can do unsupervised. Levels 3 and 4 describe
              well-defined work under broad guidance — you can execute a task correctly. Level 5 is
              where responsibility appears: you handle variation and make judgment calls. Levels 6
              and above cover specialist work and supervising others.
            </p>
            <p>
              The jump from 4 to 5 is the one that changes pay bands, because it is the first level
              where an employer can leave you alone with a problem. If you are at 4, the shortest
              route to a raise is usually the assessment for 5, not another certificate at the same
              rung.
            </p>
            <Pullquote>
              The jump from Level 4 to Level 5 is the first time an employer can leave you alone
              with a problem. That is what they are paying for.
            </Pullquote>
          </Section>

          <Section id="money" title="What it should cost you">
            <p>
              Under the current schemes, short-term training aligned to the framework is free for
              eligible candidates, assessment included. Apprenticeships pay a stipend that is partly
              government-funded. If a center is quoting you a fee for something the scheme covers,
              that is a signal about the center, not about the certification.
            </p>
            <p>
              Ask three questions before paying anything: is this course on the national
              qualification register, who conducts the assessment, and what does the certificate say
              at the end. A center that cannot answer all three quickly is selling you attendance.
            </p>
          </Section>

          <Section id="proof" title="Building proof of work">
            <p>
              A certificate says you were assessed once. A portfolio says you have done it
              repeatedly. Together they are far stronger than either alone, and the portfolio costs
              nothing but discipline — photograph the finished job, note what was wrong before you
              arrived, note what you did.
            </p>
            <p>
              Six documented jobs beat a paragraph of adjectives. Keep them on your profile so a
              recruiter searching your trade finds evidence, not claims.
            </p>
          </Section>

          <Section id="ask" title="Asking for the raise">
            <p>
              Bring the level, the evidence and a number. Name the certification, point at two jobs
              you completed unsupervised, and state the band that work commands in your district.
              The conversation stops being about how you feel and starts being about market rate.
            </p>
            <p>
              That reframing is the entire return on the paperwork. The certificate did not make you
              skilled — you were already skilled. It made you legible.
            </p>
          </Section>

          <div className="mt-14 border-t border-ink-line pt-8">
            <p className="font-editorial text-xl leading-relaxed text-ink-soft">
              Ready to move a level? The skill board shows every skill with the ways through it
              &mdash; a course, somebody certified to teach it, or on your own &mdash; so you can
              find the one that sits a step above where you are now.
            </p>
            <Link to="/board" className="btn-primary mt-6">
              Find your next rung <ArrowUpRight size={17} aria-hidden />
            </Link>
          </div>
        </article>

        {/* ── Sticky index ─────────────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="datum border-b border-ink-line pb-2">In this guide</p>
            <nav aria-label="Article sections">
              <ol className="mt-4 space-y-3">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={active === s.id ? "true" : undefined}
                      className={`flex gap-3 font-body text-sm leading-snug transition-colors ${
                        active === s.id
                          ? "font-semibold text-saffron-500"
                          : "text-ink-soft hover:text-ink"
                      }`}
                    >
                      <span className="font-mono text-[11px] tabular-nums opacity-60">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/*
              This was "Free helpline · 1800 123 9090 · counsellors read
              certificates over the phone in 12 languages". The number did not
              exist and neither did the counsellors. Somebody unsure of their
              NSQF level — exactly the person this box is aimed at — would have
              spent their one attempt at asking on a dead line.

              Sarthi is the thing that genuinely answers, in their own
              language, from this page.
            */}
            <div className="mt-10 border border-ink-line bg-ink p-5 text-paper-light">
              <p className="kicker text-saffron-glow">Not sure of your level?</p>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-paper-light/85">
                Ask Sarthi. Describe the certificate you hold, in whichever language you are
                comfortable with, and it will tell you what it maps to and what builds on it.
              </p>
              <Link to="/cv" className="btn-primary mt-4 !py-2 !text-[11px]">
                Check your CV too
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* ══ RELATED ═══════════════════════════════════════════ */}
      <section className="border-y border-ink-line bg-paper-dim">
        <div className="container-x py-14">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-line pb-5">
              <h2 className="type-lg font-display text-ink">Where to go next</h2>
              <p className="datum">Three pages to try next</p>
            </div>
          </Reveal>

          <Stagger className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {RELATED.map((r) => (
              <StaggerItem key={r.id}>
                <Link to={r.to} className="card group flex h-full flex-col overflow-hidden">
                  <div className="aspect-[16/10] overflow-hidden border-b border-ink-line">
                    <img
                      decoding="async"
                      src={r.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="kicker">{r.kicker}</p>
                    <h3 className="mt-2.5 font-display text-xl leading-tight tracking-tight text-ink transition-colors group-hover:text-saffron-600">
                      {r.title}
                    </h3>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">{r.note}</p>
                    <span className="datum mt-auto flex items-center gap-1.5 pt-5">
                      Open <ArrowUpRight size={12} aria-hidden />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-28">
      <h2 className="type-md font-display text-ink">{title}</h2>
      <div className="mt-5 space-y-6 font-body text-lg leading-[1.75] text-ink-soft">
        {children}
      </div>
    </section>
  );
}

function Pullquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-9 border-l-4 border-saffron-500 bg-paper-light py-5 pl-6 pr-4">
      <p className="font-editorial text-2xl leading-snug text-ink">{children}</p>
    </blockquote>
  );
}
