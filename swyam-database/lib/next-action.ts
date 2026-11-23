import type { MemberMetrics } from "./profile-data";
import type { ProfileProgress } from "./profile-progress";
import type { ProfileType } from "./profile-type";
import type { CoachPlan } from "./coach";
import type { MyApplication } from "./applications";
import type { EmployerSummary, EmployerPost, EmployerApplicant, CreatedCourse } from "./employer";
import type { Enrollment } from "./profile-data";

/**
 * The one thing worth doing next.
 *
 * A dashboard that shows eleven cards of equal weight has made no decision,
 * so the reader has to make it — every time they open the page. This picks
 * one, says why it matters and how long it takes, and puts everything else
 * behind it in order.
 *
 * Two rules hold the whole file together:
 *
 *   1. Every action is derived from a count this account actually has. There
 *      is no action for a state we cannot see, and no encouragement invented
 *      to fill a gap.
 *   2. Every action goes somewhere that can complete it. A card that says
 *      "improve your CV" and links to the dashboard it is already on is the
 *      thing this is meant to replace.
 */

export interface NextAction {
  id: string;
  /** Imperative and specific: "Revise Algebra for 20 minutes". */
  title: string;
  /** One line. What having done it changes. */
  why: string;
  /** Honest estimate, or null when it genuinely depends. */
  minutes: number | null;
  cta: string;
  to: string;
  /** Real progress towards this action, where there is any. */
  progress?: { done: number; total: number; label: string };
  /** Time-bound: a deadline, an applicant waiting. Drawn differently. */
  urgent?: boolean;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* ── Learners: school, college, job seeker, working professional ─── */

export interface LearnerContext {
  type: ProfileType | null;
  metrics: MemberMetrics | undefined;
  progress: ProfileProgress;
  enrolments: Enrollment[];
  plan: CoachPlan | null;
  /** Blocks ticked this week, and how many the plan has. */
  week: { done: number; total: number };
  applications: MyApplication[];
  /** Live openings on the platform, for "there is nothing to apply to yet". */
  openings: number;
  alerts: number;
  matches: number;
  unread: number;
}

export function learnerActions(c: LearnerContext): NextAction[] {
  const out: NextAction[] = [];
  const m = c.metrics;
  const school = c.type === "school";
  const college = c.type === "college";
  const working = c.type === "jobseeker" || c.type === "professional";

  /* 1. A decision somebody else is waiting on. */
  const offered = c.applications.find((a) => a.state === "offered");
  if (offered) {
    out.push({
      id: "offer",
      title: `Answer the offer from ${offered.opportunity?.employer?.name ?? "the employer"}`,
      why: "An offer is waiting on you, and employers move on.",
      minutes: 10,
      cta: "Open the application",
      to: "/applications",
      urgent: true,
    });
  }
  const interviewing = c.applications.filter((a) => a.state === "interviewing").length;
  if (interviewing > 0) {
    out.push({
      id: "interview",
      title: `Prepare for ${plural(interviewing, "interview")}`,
      why: "You are at the interview stage. The questions for this kind of role are on the site.",
      minutes: 25,
      cta: "Interview prep",
      to: "/resources",
      urgent: true,
    });
  }

  /* 2. The study plan, for the people whose job to be done is studying. */
  if (school || college) {
    if (!c.plan) {
      out.push({
        id: "plan",
        title: school ? "Build your first study plan" : "Build your career roadmap",
        why: school
          ? "Your own marks turn into a week you can follow, subject by subject."
          : "Your degree turns into the skills, the project and the internships that follow it.",
        minutes: 6,
        cta: school ? "Start with my marks" : "Start my roadmap",
        to: "/coach",
      });
    } else if (c.week.total > 0 && c.week.done < c.week.total) {
      const next = c.plan.weeklyPlan.flatMap((d) => d.blocks).find(() => true);
      out.push({
        id: "week",
        title: next
          ? `${next.task.replace(/\.$/, "")} — ${next.minutes} minutes`
          : "Do the next block in your plan",
        why: next
          ? `${next.subject}, from the plan you built. Tick it off when it is done.`
          : "One block at a time is the whole method.",
        minutes: next?.minutes ?? 20,
        cta: "Open this week",
        to: "/coach#plan",
        progress: { done: c.week.done, total: c.week.total, label: "blocks this week" },
      });
    } else if (c.week.total > 0) {
      out.push({
        id: "practice",
        title: "Take a practice quiz",
        why: "This week's plan is done. Practice is what makes it stick.",
        minutes: 10,
        cta: "Practice now",
        to: "/coach#practice",
        progress: { done: c.week.done, total: c.week.total, label: "blocks this week" },
      });
    }
  }

  /* 3. Unfinished learning, before anything new is suggested. */
  const active = c.enrolments
    .filter((e) => e.state === "active" && e.progressPercent < 100)
    .sort((a, b) => b.progressPercent - a.progressPercent);
  const furthest = active[0];
  if (furthest) {
    out.push({
      id: "continue",
      title:
        furthest.progressPercent >= 60 ? `Finish ${furthest.title}` : `Continue ${furthest.title}`,
      why:
        furthest.progressPercent >= 60
          ? "You are most of the way through. The certificate is issued on completion."
          : "Picking up where you stopped is the cheapest progress you can make.",
      minutes: 30,
      cta: "Resume the course",
      to: `/learn/${furthest.slug}`,
      progress: { done: furthest.progressPercent, total: 100, label: "complete" },
    });
  }

  /* 4. The profile, but only the next missing thing, and only when it costs
        the member something real. */
  if (c.progress.next) {
    const n = c.progress.next;
    out.push({
      id: `profile-${n.id}`,
      title: n.label,
      why: n.why,
      minutes: n.minutes,
      cta: "Do it now",
      to: n.to,
      progress: { done: c.progress.done, total: c.progress.total, label: "profile steps" },
    });
  }

  /* 5. Work, for the people looking for it. */
  if (working) {
    const live = c.applications.filter(
      (a) => a.state !== "withdrawn" && a.state !== "rejected" && a.state !== "hired",
    ).length;
    if (live === 0 && c.openings > 0) {
      out.push({
        id: "apply",
        title: "Apply to your first opening",
        why: `There ${c.openings === 1 ? "is" : "are"} ${plural(c.openings, "opening")} listed right now, and your passport goes with the application.`,
        minutes: 8,
        cta: "See what is open",
        to: "/jobs",
      });
    }
    if (c.alerts === 0) {
      out.push({
        id: "alert",
        title: "Set a job alert",
        why: "The catalog is small and new. An alert tells you the day something fits.",
        minutes: 2,
        cta: "Set an alert",
        to: "/jobs",
      });
    }
    if ((m?.skillsOffered ?? 0) > 0 && (m?.skillsVerified ?? 0) === 0) {
      out.push({
        id: "verify",
        title: "Get one skill verified",
        why: "A verified skill is the difference between a claim and proof on your passport.",
        minutes: null,
        cta: "How verification works",
        to: "/passport",
      });
    }
  }

  /* 6. SkillSwap, where there is somebody real to swap with. */
  if (c.matches > 0 && !school) {
    out.push({
      id: "swap",
      title: `Answer ${plural(c.matches, "swap match", "swap matches")}`,
      why: "Somebody teaches what you want and wants what you teach.",
      minutes: 5,
      cta: "Open SkillSwap",
      to: "/skillswap",
    });
  }

  /* 7. Anything the platform is holding for them. */
  if (c.unread > 0) {
    out.push({
      id: "unread",
      title: `Read ${plural(c.unread, "notification")}`,
      why: "Application moves, swap requests and replies all land here.",
      minutes: 2,
      cta: "Open notifications",
      to: "/notifications",
    });
  }

  /* 8. Nothing is pending — which is itself worth saying, once. */
  if (out.length === 0) {
    out.push({
      id: "explore",
      title: school ? "Explore where your subjects lead" : "Add a skill to your passport",
      why: school
        ? "Nothing is pending. This is a good week to look at what your favorite subject becomes."
        : "Nothing is pending. The passport is what the rest of the site is scored against.",
      minutes: 10,
      cta: school ? "Explore careers" : "Open my profile",
      to: school ? "/careers" : "/profile",
    });
  }

  return out;
}

/* ── Recruiters ──────────────────────────────────────────────────── */

export interface RecruiterContext {
  summary: EmployerSummary | undefined;
  posts: EmployerPost[];
  applicants: EmployerApplicant[];
}

export function recruiterActions(c: RecruiterContext): NextAction[] {
  const out: NextAction[] = [];
  const s = c.summary;

  if (!s?.companyId) {
    out.push({
      id: "company",
      title: "Link your company to this account",
      why: "Postings, applicants and verification all hang off the company record.",
      minutes: null,
      cta: "Talk to us",
      to: "/contact",
    });
    return out;
  }

  const open = c.posts.filter((p) => p.isPublished && !p.closedAt);
  if (open.length === 0) {
    out.push({
      id: "post",
      title: "Post your first opening",
      why: "Nothing can reach you until there is something to apply to. Members whose alerts match hear the moment it is live.",
      minutes: 10,
      cta: "Post an opening",
      to: "/dashboard#post",
    });
  }

  const waiting = c.applicants.filter((a) => a.state === "submitted");
  if (waiting.length > 0) {
    const oldest = waiting[waiting.length - 1]!;
    const days = Math.floor((Date.now() - new Date(oldest.submittedAt).getTime()) / 86_400_000);
    out.push({
      id: "review",
      title: `Review ${plural(waiting.length, "new applicant")}`,
      why:
        days >= 3
          ? `The oldest has been waiting ${plural(days, "day")}. Every stage you set is dated and told to them.`
          : "Every stage you set is dated and told to the candidate.",
      minutes: waiting.length * 3,
      cta: "Open candidates",
      to: "/dashboard#candidates",
      urgent: days >= 3,
      progress: {
        done: c.applicants.length - waiting.length,
        total: c.applicants.length,
        label: "applicants moved",
      },
    });
  }

  const shortlisted = c.applicants.filter((a) => a.state === "shortlisted").length;
  if (shortlisted > 0) {
    out.push({
      id: "interview",
      title: `Move ${plural(shortlisted, "shortlisted candidate")} to interview`,
      why: "A shortlist that does not move reads, to the candidate, exactly like a rejection.",
      minutes: shortlisted * 2,
      cta: "Open candidates",
      to: "/dashboard#candidates",
    });
  }

  if (open.length > 0 && c.applicants.length === 0) {
    out.push({
      id: "share",
      title: "Share your opening",
      why: "It is live and nobody has applied yet. The page works as a link anywhere.",
      minutes: 2,
      cta: "See it as candidates do",
      to: "/opportunities",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "search",
      title: "Search the passports directly",
      why: "Every member has verified skills and the work behind them. You do not have to wait to be applied to.",
      minutes: 10,
      cta: "Search candidates",
      to: "/search",
    });
  }

  return out;
}

/* ── Institutes ──────────────────────────────────────────────────── */

export interface InstituteContext {
  courses: CreatedCourse[];
}

export function instituteActions(c: InstituteContext): NextAction[] {
  const out: NextAction[] = [];
  const published = c.courses.filter((x) => x.isPublished);
  const drafts = c.courses.filter((x) => !x.isPublished);

  if (c.courses.length === 0) {
    out.push({
      id: "first-course",
      title: "Publish your first course",
      why: "Learners, enrollments and certificates all start from a published course.",
      minutes: null,
      cta: "Talk to us about publishing",
      to: "/contact",
    });
    return out;
  }

  if (drafts.length > 0) {
    out.push({
      id: "drafts",
      title: `Finish ${plural(drafts.length, "course")} in draft`,
      why: "A draft is invisible to learners. Publishing is what puts it in the catalog.",
      minutes: null,
      cta: "Open your courses",
      to: "/dashboard#courses",
      progress: { done: published.length, total: c.courses.length, label: "published" },
    });
  }

  const empty = published.filter((x) => x.enrollmentCount === 0);
  if (empty.length > 0) {
    out.push({
      id: "empty",
      title: `${plural(empty.length, "course")} with no learners yet`,
      why: "A course page works as a link. Sharing it is usually the difference.",
      minutes: 5,
      cta: "See them as learners do",
      to: "/courses",
    });
  }

  const learners = published.reduce((n, x) => n + x.enrollmentCount, 0);
  if (learners > 0) {
    out.push({
      id: "learners",
      title: `Check on ${plural(learners, "learner")}`,
      why: "Enrollments are counted by the database as they happen. Completion is what turns into a certificate.",
      minutes: 10,
      cta: "Open your courses",
      to: "/dashboard#courses",
    });
  }

  return out;
}
