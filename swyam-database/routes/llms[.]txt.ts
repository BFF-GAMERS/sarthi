import { createFileRoute } from "@tanstack/react-router";
import { courses } from "@/data/mock";
import { cachedOpenings } from "@/lib/opportunities";

/**
 * /llms.txt — the site, written for a language model.
 *
 * The format is the llmstxt.org convention: one markdown file at a fixed path
 * that an assistant can fetch in a single request instead of crawling a React
 * app and guessing. That guessing is the actual problem here — every page on
 * this site renders client-side from one shell, so a model that fetches the
 * HTML sees the shell and none of the catalogue.
 *
 * Generated rather than static for the same reason as the sitemap: the course
 * list is data, and a hand-written copy of it is a copy that goes stale.
 *
 * What it deliberately does not contain: anything behind a login. No member
 * profiles, no messages, no certificates, no training sessions. This describes
 * what the platform offers, not who is using it.
 */

const SUMMARY = `स्वYAM (Swayam) is a free Indian skilling platform. It connects learners to
vocational courses aligned to the National Skills Qualification Framework, to apprenticeships
and entry-level jobs, and to a peer-training exchange called SkillSwap where certified
trainers teach the skills they have been assessed on. Everything a learner needs — courses,
quizzes, certificates, job applications and an AI assistant — is free and behind one account.
The interface is available in 13 Indian languages.`;

const SECTIONS: Array<{ title: string; note?: string; links: Array<[string, string, string]> }> = [
  {
    title: "Start here",
    links: [
      ["Home", "/", "What the platform is, and the main entry points."],
      [
        "About",
        "/about",
        "The mission, the National Skills Qualification Framework ladder, and how certification works.",
      ],
      ["Contact", "/contact", "Support, including a voice assistant that answers in 13 languages."],
    ],
  },
  {
    title: "Learning",
    note: "Courses are free unless marked otherwise. Each carries a real syllabus, a quiz per module, and a certificate issued at 90% or above.",
    links: [
      ["All courses", "/courses", "The full catalog, filterable by sector, level, mode and fee."],
      ["Skills", "/skills", "Skills the platform recognizes, and how each one is verified."],
      [
        "Skill board",
        "/board",
        "Every skill with the routes through it: which have a course, which have a certified trainer, and which are self-paced with an AI mentor.",
      ],
      [
        "SkillSwap",
        "/skillswap",
        "Learn from a certified trainer, or teach what you are certified in. Ten successful trainings makes a Master Trainer.",
      ],
      ["Resources", "/resources", "Study material, past papers and guides."],
      ["Rewards", "/rewards", "Points earned by finishing lessons, and what they can be spent on."],
    ],
  },
  {
    title: "Work",
    links: [
      ["Jobs", "/jobs", "Entry-level and skilled roles from verified employers."],
      ["Internships", "/internships", "Apprenticeships and internships, many stipend-paying."],
      ["Opportunities", "/opportunities", "Jobs, internships and events in one feed."],
      [
        "Government schemes",
        "/schemes",
        "Scholarships and subsidies a learner may be eligible for.",
      ],
    ],
  },
  {
    title: "Community",
    links: [
      ["Community", "/community", "Questions, answers and posts from learners and trainers."],
      ["Events", "/events", "Job fairs, webinars and assessment drives."],
      [
        "Verify a certificate",
        "/verify",
        "Public check of any certificate serial issued by the platform. No login needed.",
      ],
    ],
  },
];

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { origin } = new URL(request.url);
        const openings = await cachedOpenings();
        const nJobs = openings.filter((o) => o.kind === "job").length;
        const nInternships = openings.length - nJobs;
        const link = ([title, path, note]: [string, string, string]) =>
          `- [${title}](${origin}${path}): ${note}`;

        const free = courses.filter((c) => c.free).length;

        const lines = [
          "# स्वYAM (Swayam)",
          "",
          `> ${SUMMARY.replace(/\s+/g, " ").trim()}`,
          "",
          `The catalog currently holds ${courses.length} courses (${free} of them free), ` +
            `${nJobs} job ${nJobs === 1 ? "listing" : "listings"} and ${nInternships} ${nInternships === 1 ? "internship" : "internships"}.`,
          "",
          ...SECTIONS.flatMap((s) => [
            `## ${s.title}`,
            "",
            ...(s.note ? [s.note, ""] : []),
            ...s.links.map(link),
            "",
          ]),
          "## Courses",
          "",
          ...courses.map(
            (c) =>
              `- [${c.title}](${origin}/courses/${c.id}): ${c.difficulty}, ${c.duration}, ` +
              `${c.mode.toLowerCase()}${c.free ? ", free" : `, ${c.fees}`}.`,
          ),
          "",
          "## Notes",
          "",
          "- Every page renders client-side, so fetching a URL returns the app shell rather than the content. This file and the sitemap are the reliable descriptions of the site.",
          "- Member areas (dashboard, messages, settings, admin) require a login and are intentionally not listed.",
          `- Machine-readable page list: ${origin}/sitemap.xml`,
          "",
        ];

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
