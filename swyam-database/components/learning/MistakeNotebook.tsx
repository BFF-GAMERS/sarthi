import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, NotebookPen, Trash2 } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { useTx } from "../../lib/i18n";
import {
  applyReview,
  clearScope,
  exportMistakes,
  removeMistake,
  scopeFor,
  type MistakeItem,
} from "../../lib/learning/mistakes";
import { useMistakes, useReminders } from "../../lib/learning/useMistakes";
import { DAY_MS, MAX_PER_SESSION, dueToday, pickSession } from "../../lib/learning/spaced";

/**
 * Questions worth another look.
 *
 * A calm second chance at assessment questions that did not land. One question
 * at a time, no timer, no score. The server keeps the answer key, so unless a
 * result ever exposes the right answer the learner is their own judge: we only
 * know for certain that the pick they made last time was not it, and we say so.
 * Everything lives on this device.
 */

type Round = { queue: MistakeItem[]; at: number; solid: number; again: number };

function whenLabel(item: MistakeItem, now: number, tx: (s: string) => string): string {
  if (item.dueAt <= now) return tx("Ready now");
  const days = Math.max(1, Math.ceil((item.dueAt - now) / DAY_MS));
  return `${tx("In")} ${days} ${days === 1 ? tx("day") : tx("days")}`;
}

export default function MistakeNotebook({ profileId }: { profileId: string | null }) {
  const tx = useTx();
  const { prefs } = usePreferences();
  const still = prefs.reducedMotion;
  const scope = scopeFor(profileId);
  const items = useMistakes(scope);
  const [reminders, setReminders] = useReminders();

  const [round, setRound] = useState<Round | null>(null);
  const [wrapped, setWrapped] = useState<{ solid: number; again: number } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const now = Date.now();
  const open = items.filter((i) => !i.mastered).sort((a, b) => a.dueAt - b.dueAt);
  const mastered = items.filter((i) => i.mastered);
  const due = dueToday(open, now);
  const fade = still ? { duration: 0 } : { duration: 0.25 };

  const start = () => {
    const queue = pickSession(open, now, { includeNotDue: due.length === 0 });
    if (queue.length === 0) return;
    setWrapped(null);
    setRound({ queue, at: 0, solid: 0, again: 0 });
  };

  const advance = (result: "solid" | "again" | "skip") => {
    if (!round) return;
    const next = {
      ...round,
      at: round.at + 1,
      solid: round.solid + (result === "solid" ? 1 : 0),
      again: round.again + (result === "again" ? 1 : 0),
    };
    if (next.at >= next.queue.length) {
      setWrapped({ solid: next.solid, again: next.again });
      setRound(null);
    } else {
      setRound(next);
    }
  };

  const download = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([exportMistakes(scope)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "swayam-notebook.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* a blocked download is not worth an error message */
    }
  };

  return (
    <section id="notebook" aria-labelledby="notebook-title" className="scroll-mt-28">
      <p className="datum">{tx("Notebook")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h2
          id="notebook-title"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          {tx("Questions worth another look")}
        </h2>
        {reminders && due.length > 0 && (
          <span className="chip !text-[11px]">
            {due.length} {tx("ready to revisit")}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-xl font-body text-[13.5px] leading-relaxed text-ink-soft">
        {tx(
          "Questions that didn't land are saved here so you can look again a few at a time. They stay on this device and are never sent anywhere.",
        )}
      </p>

      {round ? (
        <PracticeCard
          key={round.queue[round.at].id}
          item={round.queue[round.at]}
          index={round.at}
          total={round.queue.length}
          tx={tx}
          onDone={(correct) => {
            applyReview(scope, round.queue[round.at].id, correct);
            advance(correct ? "solid" : "again");
          }}
          onSkip={() => advance("skip")}
          onStop={() => setRound(null)}
        />
      ) : (
        <>
          {wrapped && (
            <p
              role="status"
              className="mt-5 rounded-2xl border border-ink-line bg-paper-light p-4 font-body text-[13.5px] leading-relaxed text-ink-soft"
            >
              {tx("That's the round.")}{" "}
              {wrapped.solid > 0 &&
                `${wrapped.solid} ${wrapped.solid === 1 ? tx("is feeling solid.") : tx("are feeling solid.")} `}
              {wrapped.again > 0 &&
                `${wrapped.again} ${wrapped.again === 1 ? tx("will come back soon. That's how it sticks.") : tx("will come back soon. That's how they stick.")}`}
            </p>
          )}

          {items.length === 0 ? (
            <p className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-ink-line p-5 font-body text-[13.5px] leading-relaxed text-ink-soft">
              <NotebookPen size={16} className="mt-0.5 shrink-0 text-ink-mute" aria-hidden />
              {tx(
                "Nothing here yet. When a question in an assessment doesn't land, it is saved here for a calm second look. No timer, no score.",
              )}
            </p>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {open.length > 0 && (
                  <button type="button" onClick={start} className="btn-primary !py-2.5 !text-xs">
                    {due.length > 0 ? tx("Look again") : tx("Look again anyway")}
                  </button>
                )}
                <p className="font-body text-[12.5px] text-ink-mute">
                  {open.length} {tx("saved")} · {due.length} {tx("ready to revisit")} ·{" "}
                  {tx("up to")} {MAX_PER_SESSION} {tx("at a time")}
                </p>
              </div>

              {open.length > 0 && (
                <ul className="mt-4 space-y-2">
                  <AnimatePresence initial={false}>
                    {open.map((i) => (
                      <motion.li
                        key={i.id}
                        layout={!still}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fade}
                        className="card flex items-start gap-3 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-body text-[14px] leading-snug text-ink">
                            {i.question}
                          </p>
                          {i.chosen && (
                            <p className="mt-1 font-body text-[12.5px] text-ink-mute">
                              {tx("You chose")}: {i.chosen}
                            </p>
                          )}
                          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-mute">
                            <span
                              role="img"
                              aria-label={`${tx("Box")} ${i.box} ${tx("of")} 4`}
                              className="flex gap-1"
                            >
                              {[1, 2, 3, 4].map((n) => (
                                <span
                                  key={n}
                                  aria-hidden
                                  className={`evo-learn-dot ${n <= i.box ? "evo-learn-dot-on" : ""}`}
                                />
                              ))}
                            </span>
                            <span>{whenLabel(i, now, tx)}</span>
                            <span>{i.source}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMistake(scope, i.id)}
                          aria-label={`${tx("Remove this question")}: ${i.question.slice(0, 60)}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-mute transition-colors hover:text-saffron-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {mastered.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-body text-[13px] text-ink-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron-500">
                    {tx("Settled")} ({mastered.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {mastered.map((i) => (
                      <li
                        key={i.id}
                        className="evo-learn-fade flex items-start gap-2 font-body text-[13px] text-ink-mute"
                      >
                        <Check size={13} className="mt-0.5 shrink-0" aria-hidden />
                        <span>{i.question}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-body text-[12px] text-ink-mute">
                    {tx("Settled questions fade away on their own after a month.")}
                  </p>
                </details>
              )}
            </>
          )}

          {/* ── Settings that stay on this device ─────────── */}
          <div className="mt-6 space-y-3 border-t border-ink-line pt-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={reminders}
                aria-labelledby="notebook-remind-label"
                aria-describedby="notebook-remind-hint"
                onClick={() => setReminders(!reminders)}
                className={`evo-learn-switch ${reminders ? "evo-learn-switch-on" : ""}`}
              >
                <span aria-hidden className="evo-learn-switch-knob" />
              </button>
              <div>
                <p id="notebook-remind-label" className="font-body text-[13.5px] text-ink">
                  {tx("Remind me inside स्वYAM")}
                </p>
                <p id="notebook-remind-hint" className="font-body text-[12px] text-ink-mute">
                  {tx(
                    "Off by default. Turn it on and an 'N ready to revisit' note appears here. No notifications, no emails.",
                  )}
                </p>
              </div>
            </div>

            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={download} className="btn-ghost !py-2 !text-xs">
                  <Download size={13} aria-hidden /> {tx("Export my notebook")}
                </button>
                {confirmAll ? (
                  <span role="group" aria-label={tx("Confirm delete all")} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearScope(scope);
                        setConfirmAll(false);
                        setRound(null);
                      }}
                      className="btn-ghost !py-2 !text-xs"
                    >
                      {tx("Yes, delete all")} ({items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAll(false)}
                      className="btn-ghost !py-2 !text-xs"
                    >
                      {tx("Keep them")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmAll(true)}
                    className="btn-ghost !py-2 !text-xs"
                  >
                    <Trash2 size={13} aria-hidden /> {tx("Delete all")}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** One question, no clock. */
function PracticeCard({
  item,
  index,
  total,
  tx,
  onDone,
  onSkip,
  onStop,
}: {
  item: MistakeItem;
  index: number;
  total: number;
  tx: (s: string) => string;
  onDone: (correct: boolean) => void;
  onSkip: () => void;
  onStop: () => void;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    head.current?.focus();
  }, []);

  const noOptions = item.options.length === 0;
  const knownRight = item.correct && picked !== null ? item.options[picked] === item.correct : null;
  // We can be sure of exactly two things: the stored right answer (if any), and
  // that last time's pick was wrong. Anything else is the learner's own call.
  const verdict: "right" | "wrong" | "self" =
    knownRight === true
      ? "right"
      : knownRight === false || (picked !== null && picked === item.chosenIndex)
        ? "wrong"
        : "self";
  const showing = checked || noOptions;

  return (
    <div className="panel mt-5 p-5 sm:p-6">
      <p className="font-mono text-[11px] tabular-nums text-ink-mute">
        {tx("Question")} {index + 1} {tx("of")} {total} · {tx("no timer, take your time")}
      </p>
      <h3
        ref={head}
        tabIndex={-1}
        className="mt-2 font-display text-lg leading-snug tracking-tight text-ink outline-none"
      >
        {tx("Let's look again")}
      </h3>
      <p className="mt-2 font-body text-[15px] leading-relaxed text-ink">{item.question}</p>

      {!noOptions && (
        <fieldset className="mt-4" disabled={checked}>
          <legend className="sr-only">{tx("Choose an answer")}</legend>
          <div className="space-y-2">
            {item.options.map((o, n) => (
              <label key={n} className={`evo-learn-option ${picked === n ? "evo-learn-on" : ""}`}>
                <input
                  type="radio"
                  name={`mistake-${item.id}`}
                  checked={picked === n}
                  onChange={() => setPicked(n)}
                  className="mt-1 accent-[var(--color-saffron-500)]"
                />
                <span className="font-body text-[14px] leading-snug text-ink">{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div
        role="status"
        aria-live="polite"
        className="mt-4 font-body text-[13.5px] leading-relaxed"
      >
        {showing && verdict === "right" && (
          <p className="text-ink">{tx("That's it. Nicely done.")}</p>
        )}
        {showing && verdict === "wrong" && (
          <p className="text-ink">
            {tx("Not yet. That's how it sticks.")}{" "}
            {knownRight === null
              ? tx(
                  "This was your pick last time, and it wasn't the one. Have another look at the lesson, then try again later.",
                )
              : tx("Have another look at the lesson, and this will come back soon.")}
          </p>
        )}
        {showing && verdict === "self" && (
          <p className="text-ink-soft">
            {noOptions
              ? tx("Think it through, then check the lesson.")
              : tx(
                  "We can't mark this one for you, because the answer key stays on the server. You're the judge. Check the lesson if you like.",
                )}{" "}
            {tx("How did it feel?")}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!showing && (
          <button
            type="button"
            disabled={picked === null}
            onClick={() => setChecked(true)}
            className="btn-primary !py-2.5 !text-xs disabled:opacity-60"
          >
            {tx("Check my answer")}
          </button>
        )}
        {showing && verdict !== "self" && (
          <button
            type="button"
            onClick={() => onDone(verdict === "right")}
            className="btn-primary !py-2.5 !text-xs"
          >
            {tx("Next")}
          </button>
        )}
        {showing && verdict === "self" && (
          <>
            <button
              type="button"
              onClick={() => onDone(true)}
              className="btn-primary !py-2.5 !text-xs"
            >
              {tx("I've got it now")}
            </button>
            <button
              type="button"
              onClick={() => onDone(false)}
              className="btn-ghost !py-2.5 !text-xs"
            >
              {tx("Not yet")}
            </button>
          </>
        )}
        {!showing && (
          <button type="button" onClick={onSkip} className="btn-ghost !py-2.5 !text-xs">
            {tx("Skip for now")}
          </button>
        )}
        <button type="button" onClick={onStop} className="btn-ghost !py-2.5 !text-xs">
          {tx("Stop for today")}
        </button>
      </div>
    </div>
  );
}
