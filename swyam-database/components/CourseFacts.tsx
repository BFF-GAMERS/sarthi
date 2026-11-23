import { Link } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Globe,
  IndianRupee,
  Languages,
  Laptop,
  ListChecks,
  MapPin,
  ReceiptText,
  Users,
} from "lucide-react";
import type { Course, Organization } from "../data/mock";
import { useTx } from "../lib/i18n";
import ListingDecoded from "./ListingDecoded";

/**
 * The facts a learner needs before they enrol, in one block.
 *
 * Fee, when it starts, how many seats, how long, how many hours a week,
 * where, in which language, what you need first, what you need to have,
 * who issues the certificate, how you are assessed, whether there is help
 * finding work, and what happens to your money.
 *
 * The rule for every row: say what we know, and where we do not know, say
 * "ask the institute" and link to it. A start date or a seat count that
 * nobody gave us is not something to make up — a learner who turns up on a
 * date we invented has been lied to by the site.
 *
 * Some rows are true of every course on the platform and can be stated
 * plainly: no payment is taken on स्वYAM, every course ends in an
 * assessment, every certificate carries a serial anyone can verify.
 */

export function isSelfPaced(course: Course): boolean {
  return course.mode === "Online";
}

export function startLine(course: Course, tx: (s: string) => string): string {
  if (course.startsOn) {
    return new Date(course.startsOn).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return isSelfPaced(course)
    ? tx("Start any time — self-paced")
    : tx("Next batch: ask the institute");
}

/** "Offline" is the catalog's word; a learner reads "In person". */
export function modeLabel(course: Course, tx: (s: string) => string): string {
  if (course.mode === "Offline") return tx("In person");
  if (course.mode === "Hybrid") return tx("Hybrid");
  if (course.mode === "Online") return tx("Online");
  return course.mode;
}

export function feeLine(course: Course, tx: (s: string) => string): string {
  return course.free || course.fees.startsWith("Free") ? tx("Free") : course.fees;
}

/**
 * Hours a week, read out of the duration string when the institute wrote it
 * there ("4 months · 10 hrs/week") and no separate figure was given.
 */
export function hoursPerWeek(course: Course): number | null {
  if (course.hoursPerWeek) return course.hoursPerWeek;
  const m = /(\d+)\s*(?:hrs?|hours?)\s*\/\s*week/i.exec(course.duration);
  return m ? Number(m[1]) : null;
}

export default function CourseFacts({ course, org }: { course: Course; org: Organization }) {
  const tx = useTx();
  const self = isSelfPaced(course);
  const ask = (
    <Link to="/orgs/$id" params={{ id: org.id }} className="text-saffron-600 underline">
      {tx("Ask the institute")}
    </Link>
  );
  // The course's own place, once: not the institute's head office or its other sites.
  const place = [course.city, course.state]
    .map((p) => p?.trim())
    .filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i)
    .join(", ");

  const rows: { icon: typeof Clock; label: string; value: React.ReactNode }[] = [
    {
      icon: IndianRupee,
      label: tx("Fee"),
      value: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{feeLine(course, tx)}</span>
          {!course.free && <span className="chip !text-[10.5px]">{tx("Paid")}</span>}
          {course.scholarship && !course.free && (
            <span className="chip !text-[10.5px]">{tx("Scholarship available")}</span>
          )}
        </span>
      ),
    },
    { icon: CalendarDays, label: tx("Starts"), value: startLine(course, tx) },
    {
      icon: Users,
      label: tx("Seats"),
      value: course.seats
        ? `${course.seats} ${tx("in the next batch")}`
        : self
          ? tx("No seat limit")
          : ask,
    },
    { icon: Clock, label: tx("Duration"), value: course.duration },
    {
      icon: BarChart3,
      label: tx("Time per week"),
      value: hoursPerWeek(course)
        ? `~${hoursPerWeek(course)} ${tx("hours")}`
        : self
          ? tx("Your own pace")
          : ask,
    },
    { icon: Laptop, label: tx("Mode"), value: modeLabel(course, tx) },
    {
      icon: MapPin,
      label: tx("Where"),
      value: self ? tx("Anywhere with internet") : place || ask,
    },
    {
      icon: Languages,
      label: tx("Language"),
      value: course.language ?? tx("Course text follows your language setting; videos as recorded"),
    },
    {
      icon: ListChecks,
      label: tx("Before you start"),
      value: course.prerequisites?.length
        ? course.prerequisites.join(", ")
        : course.difficulty === "Beginner"
          ? tx("Nothing — this starts from zero")
          : tx("Some background is expected; the first module lists what you need"),
    },
    {
      icon: Globe,
      label: tx("You will need"),
      value: course.equipment?.length
        ? course.equipment.join(", ")
        : self
          ? tx("A phone or computer with internet")
          : ask,
    },
    {
      icon: Award,
      label: tx("Certificate"),
      value: (
        <span>
          {tx("Issued by")} <span className="font-semibold">{org.name}</span>
          <span className="block text-ink-mute">{course.certification}</span>
          <span className="block text-ink-mute">
            {tx("Carries a serial anyone can check on the verify page, no account needed.")}
          </span>
        </span>
      ),
    },
    {
      icon: ClipboardCheck,
      label: tx("Assessment"),
      value: tx(
        "A final assessment. The certificate is issued on passing it — not on reaching the last lesson.",
      ),
    },
    {
      icon: Users,
      label: tx("Placement support"),
      value: course.placementAssistance
        ? tx("Yes — the institute helps with openings after you finish")
        : tx("No"),
    },
    {
      icon: ReceiptText,
      label: tx("Payment & refunds"),
      value:
        course.refundPolicy ??
        tx(
          "No payment is taken on स्वYAM. A paid course is settled with the institute directly, and its refund terms apply — ask before you pay.",
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5 sm:p-6">
        <h2 className="font-display text-xl text-ink">{tx("At a glance")}</h2>
        <dl className="mt-4 divide-y divide-ink-line">
          {rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[1.5rem_7.5rem_1fr] items-start gap-x-3 py-3 sm:grid-cols-[1.5rem_9rem_1fr]"
            >
              <r.icon size={16} className="mt-0.5 text-saffron-500" aria-hidden />
              <dt className="font-body text-[13px] text-ink-mute">{r.label}</dt>
              <dd className="min-w-0 font-body text-[14px] text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Questions every course gets asked; an institute's own list replaces it. */
export function CourseFaqs({ course, org }: { course: Course; org: Organization }) {
  const tx = useTx();
  const faqs = course.faqs ?? [
    {
      q: tx("How do I enroll?"),
      a: tx(
        "Press Enroll. A free course opens straight away. A paid one is settled with the institute — press Enroll, then arrange the fee with them directly.",
      ),
    },
    {
      q: tx("Is the certificate real?"),
      a: `${tx("Every certificate carries a serial. Anyone can type it into the verify page and see the course, the assessment passed and the date — no account needed. It is issued by")} ${org.name}.`,
    },
    {
      q: tx("Can I do it in my language?"),
      a: tx(
        "The interface and the course text follow the language you choose in Settings — 23 languages. Videos play as they were recorded.",
      ),
    },
    {
      q: tx("What if I cannot pay?"),
      a: tx(
        "Half the catalog is free. Points earned by finishing lessons, passing assessments and teaching on SkillSwap turn into discounts — enough points can cover a paid course completely.",
      ),
    },
    {
      q: tx("Do I need to be online?"),
      a:
        course.mode === "Online"
          ? tx("For the lessons, yes. Every video has a text version for slow connections.")
          : course.mode === "Hybrid"
            ? tx(
                "Partly. Some sessions are online and some meet in person — see Where, above. Ask the institute what happens if you miss a day.",
              )
            : tx(
                "This course meets in person — see Where, above. Ask the institute what happens if you miss a day.",
              ),
    },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-ink">{tx("Questions people ask")}</h2>
      <div className="mt-5 space-y-2">
        {faqs.map((f) => (
          <details key={f.q} className="card group p-4">
            <summary className="cursor-pointer list-none font-body text-[15px] font-semibold text-ink marker:content-none">
              {f.q}
            </summary>
            <p className="mt-2 font-body text-[14px] leading-relaxed text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
