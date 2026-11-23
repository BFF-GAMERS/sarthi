import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, Wand2 } from "lucide-react";
import type { MatchResponse } from "@/routes/api/skill-matcher";
import { useTx } from "../lib/i18n";

const KIND_ROUTE = {
  course: "/courses/$id",
  internship: "/internships/$id",
  job: "/jobs/$id",
} as const;

/**
 * Skill Matcher — posts two plain-language fields to /api/skill-matcher and
 * renders a ranked shortlist. Every result carries its reasons, because a
 * bare match percentage tells someone nothing about what to do next.
 */
export default function SkillMatcher() {
  const tx = useTx();
  const [have, setHave] = useState("");
  const [want, setWant] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (!have.trim() && !want.trim()) {
      setStatus("error");
      setError("Fill in at least one field so there's something to match against.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/skill-matcher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ have, want }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The matcher didn't respond. Try again.");
      }
      setData((await res.json()) as MatchResponse);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The matcher didn't respond. Try again.");
      setStatus("error");
    }
  }

  return (
    <section className="border-b border-ink-line bg-paper-dim">
      <div className="container-x py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="kicker flex items-center gap-1.5">
              <Wand2 size={12} aria-hidden /> {tx("Skill matcher")}
            </p>
            <h2 className="type-lg mt-3 font-display text-ink">
              {tx("Describe the work.")}
              <span className="block text-saffron-500">{tx("We'll find the rung.")}</span>
            </h2>
            <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-ink-soft">
              {tx(
                "Two sentences in your own words \u2014 no CV, no dropdowns. The matcher reads them against every listing in the index and shows why each one surfaced.",
              )}
            </p>
          </div>

          <div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="datum">{tx("What you can already do")}</span>
                <input
                  value={have}
                  onChange={(e) => setHave(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder={tx("wiring, ITI electrician, two years site work")}
                  className="field-rule !pt-3 !text-base"
                />
              </label>
              <label className="block">
                <span className="datum">{tx("Where you want to end up")}</span>
                <input
                  value={want}
                  onChange={(e) => setWant(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder={tx("solar installation, something paid")}
                  className="field-rule !pt-3 !text-base"
                />
              </label>
            </div>

            <button
              onClick={run}
              disabled={status === "loading"}
              className="btn-primary mt-6 disabled:opacity-60"
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden /> {tx("Matching")}
                </>
              ) : (
                <>
                  {tx("Match me")} <ArrowUpRight size={16} aria-hidden />
                </>
              )}
            </button>

            {status === "error" && (
              <p
                role="alert"
                className="mt-4 border-l-[3px] border-saffron-500 pl-3 font-body text-sm text-ink"
              >
                {error}
              </p>
            )}

            <AnimatePresence>
              {status === "done" && data && (
                <motion.div
                  initial={{ y: 12 }}
                  animate={{ y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-8"
                >
                  {data.category && (
                    <p className="font-body text-sm text-ink-soft">
                      Closest track:{" "}
                      <Link
                        to="/skills"
                        className="font-semibold text-saffron-500 underline underline-offset-4"
                      >
                        {data.category.name}
                      </Link>
                    </p>
                  )}

                  {data.results.length === 0 ? (
                    <p className="mt-3 font-body text-sm text-ink-soft">
                      {tx(
                        "Nothing scored high enough to recommend honestly. Try naming a tool, machine or software you've used.",
                      )}
                    </p>
                  ) : (
                    <ul className="mt-4 border-t border-ink-line">
                      {data.results.map((r) => (
                        <li key={`${r.kind}-${r.id}`} className="border-b border-ink-line">
                          <Link
                            to={KIND_ROUTE[r.kind]}
                            params={{ id: r.id }}
                            className="group flex items-start justify-between gap-4 py-3.5"
                          >
                            <span className="min-w-0">
                              <span className="font-display text-base leading-tight tracking-tight text-ink group-hover:text-saffron-500">
                                {r.title}
                              </span>
                              <span className="mt-0.5 block font-body text-xs text-ink-mute">
                                {r.org} · {r.meta}
                              </span>
                              <span className="mt-1.5 flex flex-wrap gap-1.5">
                                {r.because.map((b) => (
                                  <span
                                    key={b}
                                    className="border border-ink/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft"
                                  >
                                    {b}
                                  </span>
                                ))}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-saffron-500">
                              {Math.min(99, r.score)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {data.gaps.length > 0 && (
                    <p className="mt-4 font-body text-xs leading-relaxed text-ink-mute">
                      <span className="font-semibold uppercase tracking-wide">
                        {tx("Gaps to close:")}
                      </span>{" "}
                      {data.gaps.join(" · ")}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
