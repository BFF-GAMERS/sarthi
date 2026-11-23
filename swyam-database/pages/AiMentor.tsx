import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { usePreferences } from "../context/PreferencesContext";
import { skillBoard } from "../lib/board";
import {
  askGuide,
  completedModules,
  fetchPlan,
  forgetPlan,
  savePlan,
  savedPlan,
  setModuleDone,
  type MentorPlan,
} from "../lib/mentor";
import { useTx } from "../lib/i18n";
import { SloganPlate } from "../components/Ornaments";
import { track, EV } from "@/evolution";
import { entityId } from "@/evolution/runtime/tracker/track";

/**
 * Self-paced learning, with an AI mentor instead of a trainer.
 *
 * Choosing "self-paced" used to drop the learner into the trainer-matching
 * flow, where they were shown people to book time with — which is the one
 * thing self-paced means they are not doing. Now it comes here, and no human
 * appears anywhere on the page.
 *
 * The mentor is deliberately limited to two jobs: it writes the modules, and
 * it guides while the learner works. It will not hand over finished work,
 * because the assessment at the end is the point of the certificate, and a
 * mentor that does the exercise for you is quietly making sure you fail it.
 */

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export default function AiMentor() {
  const tx = useTx();
  const { slug } = useParams({ from: "/mentor/$slug" });
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;

  // The board knows the skill's real name and whether a human could teach it;
  // falling back to the slug means the page still works if that call fails.
  const board = useQuery({ queryKey: ["skill-board"], queryFn: () => skillBoard(300) });
  const onBoard = useMemo(
    () => (board.data ?? []).find((s) => s.slug === slug),
    [board.data, slug],
  );
  const skillName = onBoard?.name ?? slugToName(slug);

  const [plan, setPlan] = useState<MentorPlan | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("beginner");
  const [goal, setGoal] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(savedPlan(slug));
    setDone(completedModules(slug));
    setOpen(0);
  }, [slug]);

  const build = useMutation({
    mutationFn: () =>
      fetchPlan({
        skill: skillName,
        level,
        goal: goal.trim() || undefined,
        language: prefs.locale,
      }),
    onSuccess: (p) => {
      track(EV.SKILL_BUILDER_OPENED, { action: "plan_built" }, { entityId: entityId("skl", slug) });
      savePlan(slug, p);
      setPlan(p);
      setOpen(0);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleDone = (i: number, value: boolean) => setDone(setModuleDone(slug, i, value));

  const total = plan?.modules.length ?? 0;
  const percent = total === 0 ? 0 : Math.round((done.length / total) * 100);
  const minutes = plan?.modules.reduce((n, m) => n + m.minutes, 0) ?? 0;

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <SloganPlate tone="peacock">{tx("AI mentorship")}</SloganPlate>
        <h1 className="section-title mt-3">{skillName}</h1>
        <p className="type-lede mt-4 max-w-2xl">
          {tx(
            "You are learning this on your own, so there is no trainer to book and no session to attend. Your mentor writes the plan and answers while you work — it will not do the work for you.",
          )}
        </p>
      </Reveal>

      {/* ── No plan yet ─────────────────────────────────────────── */}
      {!plan && (
        <div className="card mt-9 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron-500/12 text-saffron-600"
            >
              <Sparkles size={19} />
            </span>
            <div>
              <h2 className="font-display text-xl leading-tight tracking-tight text-ink">
                {tx("Build my plan")}
              </h2>
              <p className="mt-1.5 font-body text-sm text-ink-soft">
                {tx("Two questions, and you get modules in the order they should be learnt.")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="datum">{tx("Where are you starting?")}</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
                className="input mt-1.5 !py-2.5 !text-[13px]"
              >
                <option value="beginner">{tx("Never done it")}</option>
                <option value="intermediate">{tx("I know some of it")}</option>
                <option value="advanced">{tx("I work with it already")}</option>
              </select>
            </label>
            <label className="block">
              <span className="datum">{tx("What do you want out of it?")}</span>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={tx("Optional — e.g. a job, a side income, a specific task")}
                className="input mt-1.5 !py-2.5 !text-[13px]"
                maxLength={120}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 font-body text-[13px] text-danger">
              {error}
            </p>
          )}

          <button
            onClick={() => build.mutate()}
            disabled={build.isPending}
            className="btn-primary mt-6 !py-3 disabled:opacity-60"
          >
            {build.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                {tx("Writing your plan…")}
              </>
            ) : (
              <>
                <Bot size={16} aria-hidden />
                {tx("Build my plan")}
              </>
            )}
          </button>

          {onBoard && onBoard.trainers > 0 && (
            <p className="mt-6 border-t border-ink-line pt-4 font-body text-[12px] text-ink-mute">
              {onBoard.trainers}{" "}
              {onBoard.trainers === 1
                ? tx("person is certified to teach this.")
                : tx("people are certified to teach this.")}{" "}
              <Link to="/skillswap" className="underline underline-offset-4 hover:text-saffron-600">
                {tx("Learn it with one of them instead")}
              </Link>
            </p>
          )}
        </div>
      )}

      {/* ── The plan ────────────────────────────────────────────── */}
      {plan && (
        <>
          <div className="card mt-9 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="datum">{tx("Your plan")}</p>
                <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-ink-soft">
                  {plan.summary}
                </p>
              </div>
              <button
                onClick={() => {
                  forgetPlan(slug);
                  setPlan(null);
                  setDone([]);
                }}
                className="btn-ghost shrink-0 !py-2 !text-xs"
              >
                <RefreshCw size={13} aria-hidden /> {tx("Start over")}
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep/70"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={tx("Plan progress")}
              >
                <motion.span
                  className="block h-full rounded-full bg-saffron-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: still ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-ink">{percent}%</span>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-ink-line pt-4">
              {[
                [tx("Modules"), `${done.length} / ${total}`],
                [tx("Study time"), `${Math.round(minutes / 60)}h`],
                [tx("Written by"), plan.generated ? tx("Your mentor") : tx("Standard plan")],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                    {k}
                  </dt>
                  <dd className="mt-0.5 font-body text-[13px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {!plan.generated && (
              <p className="mt-4 rounded-xl border border-ink-line bg-paper p-3 font-body text-[12px] leading-relaxed text-ink-mute">
                {tx(
                  "This is the standard plan — the mentor could not be reached when it was built, so it is not specific to this skill. Press “Start over” to try again.",
                )}
              </p>
            )}
          </div>

          <ol className="mt-6 space-y-3">
            {plan.modules.map((m, i) => {
              const isDone = done.includes(i);
              const isOpen = open === i;
              // Not a lock, a nudge: the order matters, but nobody is stopped
              // from reading ahead in their own plan.
              const nextUp = !isDone && done.length === i;

              return (
                <li key={`${m.title}-${i}`}>
                  <div
                    className={`card overflow-hidden ${nextUp ? "!border-saffron-200" : ""}`}
                    data-expanded={isOpen ? "true" : "false"}
                  >
                    <div className="flex items-start gap-3 p-5">
                      <button
                        onClick={() => toggleDone(i, !isDone)}
                        aria-pressed={isDone}
                        aria-label={isDone ? tx("Mark as not done") : tx("Mark as done")}
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors ${
                          isDone
                            ? "border-saffron-500 bg-saffron-500 text-on-accent"
                            : "border-ink-line text-transparent hover:border-saffron-300"
                        }`}
                      >
                        <Check size={13} aria-hidden />
                      </button>

                      <button
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`font-display text-lg leading-tight tracking-tight ${
                              isDone ? "text-ink-mute line-through" : "text-ink"
                            }`}
                          >
                            {m.title}
                          </span>
                          {nextUp && <span className="chip-accent !text-[10px]">{tx("Next")}</span>}
                        </p>
                        {m.why && (
                          <p className="mt-1 font-body text-[13px] leading-snug text-ink-soft">
                            {m.why}
                          </p>
                        )}
                        <p className="mt-1.5 inline-flex items-center gap-1.5 font-body text-[11px] text-ink-mute">
                          <Clock size={11} aria-hidden /> {m.minutes} {tx("min")} · {m.steps.length}{" "}
                          {tx("steps")}
                        </p>
                      </button>

                      <ChevronDown
                        size={17}
                        aria-hidden
                        className={`mt-1 shrink-0 text-ink-mute transition-transform duration-300 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={still ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={still ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: still ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-ink-line px-5 pb-5 pt-4">
                            <ol className="space-y-3">
                              {m.steps.map((s, si) => (
                                <li key={si} className="flex gap-3">
                                  <span
                                    aria-hidden
                                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                                  />
                                  <div>
                                    <p className="font-body text-[14px] font-medium text-ink">
                                      {s.title}
                                    </p>
                                    {s.detail && (
                                      <p className="mt-0.5 font-body text-[13px] leading-relaxed text-ink-soft">
                                        {s.detail}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ol>

                            {m.practice && (
                              <div className="mt-5 rounded-2xl border border-ink-line bg-paper p-4">
                                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-saffron-600">
                                  <Target size={12} aria-hidden /> {tx("Do this")}
                                </p>
                                <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-soft">
                                  {m.practice}
                                </p>
                              </div>
                            )}

                            {m.checks.length > 0 && (
                              <div className="mt-4">
                                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                                  {tx("Before you move on")}
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {m.checks.map((c, ci) => (
                                    <li
                                      key={ci}
                                      className="flex gap-2 font-body text-[13px] text-ink-soft"
                                    >
                                      <CheckCircle2
                                        size={14}
                                        className="mt-0.5 shrink-0 text-ink-mute"
                                        aria-hidden
                                      />
                                      {c}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <Guide skill={skillName} module={m.title} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Finishing a self-paced plan should lead somewhere, not stop. */}
          {percent === 100 && (
            <div className="card mt-6 p-6 text-center">
              <CheckCircle2 size={26} className="mx-auto text-saffron-500" aria-hidden />
              <p className="mt-3 font-display text-xl tracking-tight text-ink">
                {tx("Plan finished")}
              </p>
              <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft">
                {tx(
                  "A plan you finished on your own is not proof yet. Sit the assessment for this skill and the certificate is the same one everybody else gets.",
                )}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/courses" className="btn-primary !py-2.5 !text-xs">
                  {tx("Find the assessment")}
                </Link>
                <Link to="/community" className="btn-ghost !py-2.5 !text-xs">
                  <Users size={14} aria-hidden /> {tx("Show what you built")}
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── The guide, per module ───────────────────────────────────────── */

function Guide({ skill, module: moduleTitle }: { skill: string; module: string }) {
  const tx = useTx();
  const { prefs } = usePreferences();
  const [turns, setTurns] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (question: string) =>
      askGuide({ skill, module: moduleTitle, question, language: prefs.locale, history: turns }),
    onSuccess: (answer, question) => {
      setTurns((t) => [
        ...t,
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ]);
      setDraft("");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, send.isPending]);

  return (
    <div className="mt-5 border-t border-ink-line pt-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-mute">
        <Bot size={12} aria-hidden /> {tx("Stuck? Ask your mentor")}
      </p>

      {turns.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2 font-body text-[13px] leading-relaxed ${
                  t.role === "user"
                    ? "rounded-br-md bg-saffron-500 text-on-accent"
                    : "rounded-bl-md border border-ink-line bg-paper text-ink-soft"
                }`}
              >
                {t.role === "user" ? (
                  t.content
                ) : (
                  <div className="[&_li]:my-0.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_strong]:font-semibold [&_ul]:ml-4 [&_ul]:list-disc">
                    <ReactMarkdown>{t.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {send.isPending && (
          <motion.div
            initial={{ y: 6 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2.5 flex justify-start"
          >
            <div className="flex items-center gap-2 rounded-xl border border-ink-line bg-paper px-3 py-2.5">
              <span className="sr-only" role="status">
                {tx("Your mentor is typing")}
              </span>
              <span className="flex items-end gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{
                      duration: 1.05,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.15,
                    }}
                    className="h-1.5 w-1.5 rounded-full bg-saffron-500"
                  />
                ))}
              </span>
              <span className="font-body text-[11px] text-ink-mute">{tx("Thinking…")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {send.isError && (
        <p role="alert" className="mt-2 font-body text-[12px] text-danger">
          {(send.error as Error).message}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) send.mutate(draft.trim());
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tx("What is not working?")}
          aria-label={tx("Ask your mentor")}
          className="input !py-2 !text-[13px]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          className="btn-primary shrink-0 !px-3 !py-2 !text-xs disabled:opacity-50"
        >
          <Send size={13} aria-hidden />
        </button>
      </form>

      <p className="mt-2 font-body text-[11px] leading-relaxed text-ink-mute">
        {tx(
          "Your mentor explains and points you at the next step. It will not write your practice work — the assessment is the point.",
        )}
      </p>
      <div ref={bottomRef} />
    </div>
  );
}
