import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Trees } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { startTour } from "@/components/Tour";
import { useTx } from "@/lib/i18n";
import { sectionClick } from "../track";
import type { SectionProps } from "../types";

/* The whole product in three sentences, for someone who has never seen it. */
const steps = [
  { title: "Pick a skill", text: "Choose a course, or ask Sarthi what to learn next." },
  { title: "Learn and pass", text: "Short lessons, then a test. Pass it and earn a certificate." },
  {
    title: "Show it, get hired",
    text: "Anyone can check your certificate online. Apply to verified openings.",
  },
];

/* Same product, two lives. Every line here is something the site does today. */
const lives = [
  {
    Icon: Building2,
    title: "In a city",
    text: "Learn after college or work. Teach what you know and learn from others over live video on SkillSwap. Apply to verified openings.",
  },
  {
    Icon: Trees,
    title: "In a small town or village",
    text: "Works on a slow connection. Download lessons and study offline. Use the site in your own language.",
  },
];

export default function MethodSection(props: SectionProps) {
  const tx = useTx();
  const mark = sectionClick(props);
  return (
    <section id="how-it-works" className="container-x scroll-mt-24 py-16 lg:py-20">
      <Reveal>
        <h2 className="section-title">{tx("How it works")}</h2>
      </Reveal>

      <Stagger className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((step, i) => (
          <StaggerItem key={step.title}>
            <div className="card flex h-full gap-4 p-5">
              <span
                aria-hidden
                className="font-display text-5xl font-semibold leading-none text-saffron-500"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-body text-[1.05rem] font-semibold text-ink">
                  {tx(step.title)}
                </h3>
                <p className="mt-1 font-body text-[14px] leading-relaxed text-ink-soft">
                  {tx(step.text)}
                </p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        {lives.map(({ Icon, title, text }) => (
          <div key={title} className="flex gap-3 p-1">
            <Icon size={20} className="mt-0.5 shrink-0 text-saffron-500" aria-hidden />
            <p className="font-body text-[14px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">{tx(title)}:</span> {tx(text)}
            </p>
          </div>
        ))}
      </Reveal>

      <Reveal className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/courses" className="btn-primary" onClick={mark}>
          {tx("Browse courses")} <ArrowRight size={16} aria-hidden />
        </Link>
        <button type="button" className="btn-ghost" onClick={() => startTour("home")}>
          {tx("Show me around")}
        </button>
      </Reveal>
    </section>
  );
}
