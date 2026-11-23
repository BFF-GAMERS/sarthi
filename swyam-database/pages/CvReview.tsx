import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  Loader2,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { getOpportunity } from "../lib/opportunities";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";
import { SloganPlate } from "../components/Ornaments";
import { track, EV } from "@/evolution";

/**
 * CV review.
 *
 * The people this platform is for are usually rejected by a filter they never
 * see, for reasons nobody tells them — the file was a photo, the phone number
 * sat in a header the parser dropped, the bullet said "worked on billing"
 * where the posting said "invoicing". None of that is about whether they can
 * do the job, and all of it is fixable in an evening once somebody points at
 * it. That is the whole product here: pointing at it.
 *
 * Two things this deliberately does not do.
 *
 * It does not invent. Every suggested line is a rewrite of something they
 * wrote; anything genuinely missing comes back as a question for them to
 * answer rather than a sentence we made up. A CV that claims something untrue
 * fails at the interview, and that cost lands on the applicant.
 *
 * It does not keep the CV. There is no upload to a bucket and no row written.
 * The text goes to the review and comes back with the answer.
 */

interface Rewrite {
  original: string;
  suggested: string;
  why: string;
}

interface Review {
  score: number;
  verdict: string;
  readability: { willParse: boolean; problems: string[] };
  missing: string[];
  rewrites: Rewrite[];
  keywords: { matched: string[]; toAdd: string[] };
  gaps: string[];
  nextSteps: string[];
}

export default function CvReview() {
  const tx = useTx();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const search = useSearch({ strict: false }) as { for?: string };
  const targetSlug = search.for;

  const [cv, setCv] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  // When they arrived from a posting, review against that posting.
  const role = useQuery({
    queryKey: ["opportunity", targetSlug],
    queryFn: () => getOpportunity(targetSlug!),
    enabled: Boolean(targetSlug),
  });

  const review = useMutation<Review, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cv,
          language: prefs.locale,
          role: role.data
            ? {
                title: role.data.title,
                company: role.data.employer?.name,
                summary: role.data.summary ?? undefined,
                responsibilities: role.data.responsibilities,
                eligibility: role.data.eligibility ?? undefined,
                skills: role.data.skills,
              }
            : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "The review could not be completed.");
      return body as Review;
    },
    onSuccess: () => track(EV.CAREER_LAUNCHER_OPENED, { surface: "cv" }),
  });

  /**
   * Read a dropped or chosen file.
   *
   * Plain text only, and that is a deliberate limit rather than a missing
   * feature: parsing a PDF in the browser needs a library an order of
   * magnitude larger than this page, and a PDF exported from a phone is
   * usually an image, which no parser would read either. Asking them to paste
   * the text is the honest instruction, and it always works.
   */
  const readFile = async (file: File) => {
    if (!/\.(txt|md|rtf)$/i.test(file.name)) {
      review.reset();
      setCv("");
      window.alert(tx("Please paste the text of your CV. Word and PDF files cannot be read here."));
      return;
    }
    setCv(await file.text());
  };

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard refused; the text is on screen to copy by hand. */
    }
  };

  const words = cv.trim() ? cv.trim().split(/\s+/).length : 0;
  const data = review.data;

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="rani">{tx("CV review")}</SloganPlate>
        <h1 className="section-title mt-3">{tx("Fix the CV before you send it")}</h1>
        <p className="type-lede mt-4 max-w-2xl">
          {tx(
            "Most applications are rejected by automated screening that never tells you why. We read your CV, point out what could get it rejected, and rewrite the weak lines using only what you already wrote.",
          )}
        </p>
      </Reveal>

      {role.data && (
        <Reveal className="mt-6">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <Target size={16} className="shrink-0 text-saffron-500" aria-hidden />
            <p className="min-w-0 flex-1 font-body text-[13px] text-ink-soft">
              {tx("Reviewing against")}{" "}
              <span className="font-medium text-ink">{role.data.title}</span>
              {role.data.employer && <> · {role.data.employer.name}</>}
            </p>
            <Link to="/opportunities" className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px]">
              {tx("Change")}
            </Link>
          </div>
        </Reveal>
      )}

      {/* ── Input ───────────────────────────────────────────────── */}
      <Reveal className="mt-8">
        <label htmlFor="cv" className="datum">
          {tx("Paste your CV")}
        </label>
        <textarea
          id="cv"
          value={cv}
          onChange={(e) => setCv(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={tx(
            "Paste the whole thing — name, contact details, education, experience, skills. Plain text is fine; formatting does not matter here.",
          )}
          className="input mt-2 resize-y !text-[13px] leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => review.mutate()}
            disabled={words < 40 || review.isPending}
            className="btn-primary !py-2.5 !text-xs disabled:opacity-50"
          >
            {review.isPending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={14} aria-hidden />
            )}
            {review.isPending ? tx("Reading it…") : tx("Review my CV")}
          </button>

          <label className="btn-ghost cursor-pointer !py-2.5 !text-xs">
            <Upload size={14} aria-hidden /> {tx("Open a .txt file")}
            <input
              type="file"
              accept=".txt,.md,.rtf,text/plain"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
          </label>

          <span className="font-body text-[11px] text-ink-mute">
            {words > 0
              ? `${words} ${tx("words")}${words < 40 ? ` · ${tx("paste a bit more")}` : ""}`
              : tx("Nothing is saved. Your CV is not stored anywhere.")}
          </span>
        </div>

        {review.isError && (
          <p className="mt-3 flex items-start gap-2 font-body text-[13px] text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {review.error.message}
          </p>
        )}
      </Reveal>

      {/* ── Result ──────────────────────────────────────────────── */}
      {data && (
        <motion.div
          initial={still ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: still ? 0 : 0.4 }}
          className="mt-10 space-y-6"
        >
          {/* Verdict */}
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="datum">{tx("Where it stands")}</p>
                <p className="mt-2 font-body text-[15px] leading-relaxed text-ink">
                  {data.verdict}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-display text-4xl leading-none tabular-nums text-saffron-500">
                  {data.score}
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                  / 100
                </span>
              </div>
            </div>

            {!data.readability?.willParse && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-3 font-body text-[13px] text-danger">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                {tx(
                  "An automatic screen would struggle to read this file. Fix the points below before anything else — they cost you applications you never hear about.",
                )}
              </p>
            )}
          </div>

          {/* Things that block a screen */}
          {(data.readability?.problems?.length > 0 || data.missing?.length > 0) && (
            <section className="card p-6">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Fix these first")}
              </h2>
              <ul className="mt-3 space-y-2">
                {[...(data.readability?.problems ?? []), ...(data.missing ?? [])].map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-body text-[13px] text-ink-soft"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Line-by-line rewrites */}
          {data.rewrites?.length > 0 && (
            <section className="card p-6">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Stronger wording")}
              </h2>
              <p className="mt-1 font-body text-[12px] text-ink-mute">
                {tx(
                  "Same facts, said better. Nothing here was invented — every line is a rewrite of one of yours.",
                )}
              </p>
              <ul className="mt-4 space-y-4">
                {data.rewrites.map((r, i) => (
                  <li key={i} className="rounded-2xl border border-ink-line p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                      {tx("You wrote")}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-ink-mute line-through decoration-ink-line">
                      {r.original}
                    </p>

                    <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-saffron-600">
                      {tx("Try")}
                    </p>
                    <p className="mt-1 font-body text-[14px] font-medium leading-relaxed text-ink">
                      {r.suggested}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-body text-[11px] italic text-ink-mute">{r.why}</p>
                      <button
                        onClick={() => copy(r.suggested, i)}
                        className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                      >
                        {copied === i ? (
                          <>
                            <Check size={12} aria-hidden /> {tx("Copied")}
                          </>
                        ) : (
                          <>
                            <ClipboardPaste size={12} aria-hidden /> {tx("Copy")}
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Keywords */}
          {(data.keywords?.toAdd?.length > 0 || data.keywords?.matched?.length > 0) && (
            <section className="card p-6">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Words the posting uses")}
              </h2>
              <p className="mt-1 font-body text-[12px] text-ink-mute">
                {tx(
                  "Same work described in a different word is the most common silent rejection there is.",
                )}
              </p>
              {data.keywords.matched?.length > 0 && (
                <div className="mt-4">
                  <p className="datum">{tx("Already matching")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.keywords.matched.map((k) => (
                      <span key={k} className="chip !text-[11px]">
                        <Check size={10} aria-hidden /> {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.keywords.toAdd?.length > 0 && (
                <div className="mt-4">
                  <p className="datum">{tx("Worth using, if it is true of you")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.keywords.toAdd.map((k) => (
                      <span key={k} className="chip-accent !text-[11px]">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Gaps — questions, never invented answers */}
          {data.gaps?.length > 0 && (
            <section className="card p-6">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Only you can answer these")}
              </h2>
              <p className="mt-1 font-body text-[12px] text-ink-mute">
                {tx(
                  "Answer them in your CV and it gets noticeably stronger. We will not make anything up on your behalf.",
                )}
              </p>
              <ul className="mt-3 space-y-2">
                {data.gaps.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-body text-[13px] text-ink-soft"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-saffron-500">
                      {i + 1}
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Next steps */}
          {data.nextSteps?.length > 0 && (
            <section className="panel p-6">
              <h2 className="font-display text-lg tracking-tight text-ink">
                {tx("Do these three things")}
              </h2>
              <ol className="mt-3 space-y-2.5">
                {data.nextSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-saffron-500 font-mono text-[11px] text-on-accent"
                    >
                      {i + 1}
                    </span>
                    <span className="font-body text-[14px] leading-relaxed text-ink">{s}</span>
                  </li>
                ))}
              </ol>

              <Link to="/opportunities" className="btn-primary mt-6 inline-flex !py-2.5 !text-xs">
                <FileText size={14} aria-hidden />
                {tx("Find a role to apply to")}
                <ArrowRight size={14} aria-hidden />
              </Link>
            </section>
          )}
        </motion.div>
      )}
    </div>
  );
}
