import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Database,
  Eye,
  Flag,
  IndianRupee,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import { useTx } from "../lib/i18n";

/**
 * The trust centre: what this platform checks, what it does not, what it
 * keeps, and what it promises — which is, deliberately, very little.
 *
 * Every sentence here describes something the code actually does. Where the
 * honest answer is "not yet" (an account-deletion button, a low-data mode)
 * the page says "not yet" rather than leaving the reader to assume. The
 * page is worth more for the second kind of sentence than the first.
 */
export default function TrustCentre() {
  const tx = useTx();

  const sections: {
    id: string;
    icon: React.ReactNode;
    title: string;
    lead: string;
    points: { yes?: boolean; kind?: "limit" | "notyet"; text: string }[];
    link?: { to: string; label: string };
  }[] = [
    {
      id: "verified",
      icon: <BadgeCheck size={18} />,
      title: tx("What “Verified” means"),
      lead: tx(
        "A person on the स्वYAM team has confirmed that the employer or institute exists, is who it says it is, and can be contacted at the details it gave us.",
      ),
      points: [
        {
          kind: "limit",
          text: tx(
            "It does not mean a course is accredited by a government body, or that we have sat in on a class.",
          ),
        },
        {
          kind: "limit",
          text: tx(
            "It does not mean we have checked an employer's pay, working conditions or contract.",
          ),
        },
        {
          yes: true,
          text: tx(
            "Unverified is not a warning; it means nobody has checked yet, and the listing says so plainly.",
          ),
        },
        {
          yes: true,
          text: tx("A verified mark can be taken away after a report."),
        },
      ],
    },
    {
      id: "certificates",
      icon: <ShieldCheck size={18} />,
      title: tx("Certificates and assessments"),
      lead: tx(
        "A certificate is issued automatically only when the records show you qualified, never by someone clicking a button: the enrollment must be 100% complete, and where the course has a final assessment, there must be a passed attempt on record.",
      ),
      points: [
        {
          yes: true,
          text: tx(
            "Every certificate carries a serial. Anyone — an employer, a parent — can type it into the Verify page and see the record it came from.",
          ),
        },
        {
          yes: true,
          text: tx(
            "The certificate names the institute that ran the course. स्वYAM is the record-keeper, not the awarding body.",
          ),
        },
        {
          kind: "limit",
          text: tx(
            "A स्वYAM certificate is not a government qualification and is not presented as one.",
          ),
        },
      ],
    },
    {
      id: "numbers",
      icon: <Scale size={18} />,
      title: tx("The numbers on this site"),
      lead: tx(
        "Every count — learners enrolled, applicants, openings, members — is read from the database at the moment you look. None is typed in.",
      ),
      points: [
        {
          yes: true,
          text: tx(
            "Where a number is zero it is shown as nothing, or as “New course”, rather than dressed up. A course with no reviews says so.",
          ),
        },
        {
          yes: true,
          text: tx(
            "Job listings and course pages carry a “Last updated” date so you can judge how fresh they are.",
          ),
        },
        {
          yes: true,
          text: tx(
            "The jobs list is short because the platform is new. The page says so, and offers an alert instead of padding.",
          ),
        },
      ],
    },
    {
      id: "promises",
      icon: <IndianRupee size={18} />,
      title: tx("What we do not promise"),
      lead: tx("Nothing on this site guarantees an outcome, and nothing here is allowed to."),
      points: [
        {
          kind: "limit",
          text: tx(
            "No guarantee of admission, employment, a salary, a placement, or finishing a course. Where a course offers placement support, that is what it says — support.",
          ),
        },
        {
          kind: "limit",
          text: tx(
            "No payment is taken on स्वYAM. Enrolling, on its own or from your cart, signs you up for the course; for a paid course it reserves your seat and puts you in touch with the institute. The fee is paid to the institute, on the institute's terms. Ask them for the refund policy before you pay.",
          ),
        },
        {
          kind: "limit",
          text: tx(
            "The scheme pages summarize government schemes in plain language; the ministry's own page, linked on each one, is the one that counts.",
          ),
        },
      ],
    },
    {
      id: "ai",
      icon: <Bot size={18} />,
      title: tx("Where AI is used, and where it is not"),
      lead: tx(
        "These are written by an AI model: Sarthi the assistant (in chat, on the phone and in community replies), the Study & Career Coach, the AI mentor's self-paced study plans and hints, the CV review, and the scheme eligibility checker. Each says so where it appears. AI may also suggest the order of the navigation, the home page and the membership card, and work out where a short typed request should take you, but only by choosing from a fixed list, and the site works without it. Pages shown in a language other than English are translated automatically too, so a translation can be imperfect; the English is the original.",
      ),
      points: [
        {
          yes: true,
          text: tx(
            "The coach may recommend only courses that exist in the catalog; every recommendation is checked against the list before you see it.",
          ),
        },
        {
          yes: true,
          text: tx(
            "Your marks, CV and scheme answers are sent to the model for that one request and are not stored by स्वYAM. The coach's plan is kept only on your own device, and you can delete it there.",
          ),
        },
        {
          yes: true,
          text: tx(
            "Sarthi's replies in the community are posted under Sarthi's own name, never as a person.",
          ),
        },
        {
          kind: "limit",
          text: tx(
            "Certificates, assessment results, verification marks and application decisions are never made by AI.",
          ),
        },
      ],
    },
    {
      id: "data",
      icon: <Database size={18} />,
      title: tx("What we keep about you"),
      lead: tx(
        "Your profile, skills, enrollments, progress, certificates, applications, messages and settings — the things you can see on your own pages. Nothing is sold, and nothing is shared with an employer until you apply to them.",
      ),
      points: [
        {
          yes: true,
          text: tx(
            "स्वYAM learns from what you do here, on this device, to arrange itself. Nothing is sold or shared, no sensitive attributes are used, and Reset my experience clears it. Optional account sync stores aggregates only, never for minors.",
          ),
        },
        {
          yes: true,
          text: tx(
            "When you apply, the employer receives your application, your note and your Skill Passport as it stood at that moment. That is the whole of what they get.",
          ),
        },
        {
          yes: true,
          text: tx(
            "You choose who can see your profile in Settings, and you can block anyone from their profile.",
          ),
        },
        {
          yes: true,
          text: tx(
            "Your Skill Passport is public only if you share its link; the link can be turned off.",
          ),
        },
        {
          kind: "notyet",
          text: tx(
            "There is not yet a delete-my-account button. Until there is, write to us from the Contact page and a person deletes the account and everything under it.",
          ),
        },
      ],
      link: { to: "/settings", label: tx("Privacy settings") },
    },
    {
      id: "safety",
      icon: <Flag size={18} />,
      title: tx("Reporting and moderation"),
      lead: tx(
        "Every profile, post, comment, message and listing can be reported. A report goes to a person, who can remove the content, warn, or remove a verified mark.",
      ),
      points: [
        {
          yes: true,
          text: tx(
            "Blocking someone removes any follow between you and stops their notifications reaching you. Nobody is told they were blocked.",
          ),
        },
        {
          yes: true,
          text: tx("Reports are read by the team, not by an automated filter."),
        },
      ],
      link: { to: "/contact", label: tx("Contact the team") },
    },
    {
      id: "access",
      icon: <Eye size={18} />,
      title: tx("Language and access"),
      lead: tx(
        "The interface can be read in your language, at a larger text size, in high contrast, with a dyslexia-friendly typeface and with reduced motion. These are in Settings, and they follow your account.",
      ),
      points: [
        {
          kind: "notyet",
          text: tx(
            "A low-data mode and downloadable lesson materials. Video lessons play only online.",
          ),
        },
      ],
      link: { to: "/settings", label: tx("Access settings") },
    },
  ];

  return (
    <div className="container-x max-w-4xl pb-24 pt-32">
      <Reveal>
        <SloganPlate tone="peacock">{tx("Trust center")}</SloganPlate>
        <h1 className="section-title mt-4">
          {tx("What is checked, what is kept, what is promised")}
        </h1>
        <BlockPrintRule className="mt-5" />
        <p className="mt-5 max-w-2xl font-body text-[15px] leading-relaxed text-ink-soft">
          {tx(
            "The whole argument of this platform is that a claim about a skill should be checkable. That has to start with the platform's own claims. Everything below describes what the site actually does today — including the things it does not do yet.",
          )}
        </p>
        <nav aria-label={tx("On this page")} className="mt-6 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="filter-pill !h-9 !px-3 !text-[12px]">
              {s.title}
            </a>
          ))}
        </nav>
      </Reveal>

      <div className="mt-10 space-y-6">
        {sections.map((s) => (
          <Reveal key={s.id}>
            <section id={s.id} className="card scroll-mt-28 p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e6f2f3] text-peacock"
                >
                  {s.icon}
                </span>
                <h2 className="font-display text-xl tracking-tight text-ink">{s.title}</h2>
              </div>
              <p className="mt-4 font-body text-[15px] leading-relaxed text-ink">{s.lead}</p>
              <ul className="mt-4 space-y-2.5">
                {s.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className={`mt-[3px] inline-flex h-5 shrink-0 items-center rounded-full px-1.5 font-mono text-[10px] font-bold uppercase ${
                        p.kind
                          ? "bg-paper-deep text-ink-soft"
                          : "bg-emeraldx-400/10 text-emeraldx-400"
                      }`}
                    >
                      {p.kind === "notyet"
                        ? tx("Not yet")
                        : p.kind === "limit"
                          ? tx("Limit")
                          : tx("Yes")}
                    </span>
                    <span className="font-body text-[14px] leading-relaxed text-ink-soft">
                      <span className="sr-only">
                        {p.kind === "notyet"
                          ? tx("Not yet: ")
                          : p.kind === "limit"
                            ? tx("Limits: ")
                            : ""}
                      </span>
                      {p.text}
                    </span>
                  </li>
                ))}
              </ul>
              {s.link && (
                <Link
                  to={s.link.to}
                  className="mt-5 inline-flex items-center gap-1.5 font-body text-[13px] font-semibold text-saffron-600 hover:underline"
                >
                  {s.link.label} <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </section>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-10 rounded-2xl border border-ink-line p-6">
          <p className="inline-flex items-center gap-2 font-display text-lg text-ink">
            <Sparkles size={16} className="text-saffron-500" aria-hidden />
            {tx("Found something on this page that is not true?")}
          </p>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">
            {tx(
              "Tell us from the Contact page. This page is only worth having if it is right, and it is corrected before anything else is.",
            )}
          </p>
          <Link to="/contact" className="btn-primary mt-4 !py-2.5 !text-xs">
            {tx("Contact")} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
