/**
 * Extra description, for people who asked for it.
 *
 * A progress bar and a match score are read by sighted people in a glance and
 * by everyone else not at all: `62%` next to a coloured rectangle says nothing
 * about what is finished or why the number is what it is. Switching on "Extra
 * screen-reader detail" in Settings turns these into sentences.
 *
 * It is opt-in rather than always-on because the same verbosity that helps one
 * person makes a page exhausting to listen to for another, who already gets
 * the number from the visible label.
 */

import { usePreferences } from "../context/PreferencesContext";

/** Whether this member asked for the longer descriptions. */
export function useDetail(): boolean {
  const { prefs } = usePreferences();
  return prefs.screenReaderHints;
}

/** "7 of 12 lessons finished, 58 percent. 5 lessons left." */
export function describeProgress(done: number, total: number, title?: string): string {
  if (total <= 0) return title ? `${title}: not started.` : "Not started.";
  const percent = Math.round((done / total) * 100);
  const left = total - done;
  const head = title ? `${title}: ` : "";
  if (left === 0) return `${head}all ${total} lessons finished. Complete.`;
  return (
    `${head}${done} of ${total} lessons finished, ${percent} percent. ` +
    `${left} lesson${left === 1 ? "" : "s"} left.`
  );
}

/**
 * The same sentence where only the percentage is known.
 *
 * A listing knows how far along an enrolment is without having loaded the
 * lesson list, and fetching every syllabus just to phrase a label would be a
 * poor trade.
 */
export function describeProgressPercent(done: number, percent: number, title?: string): string {
  const head = title ? `${title}: ` : "";
  if (percent >= 100) return `${head}complete.`;
  if (done === 0) return `${head}enrolled, not started.`;
  return `${head}${done} lesson${done === 1 ? "" : "s"} finished, ${Math.round(percent)} percent.`;
}

/** "A 78 percent match: they teach Python, which you want to learn." */
export function describeMatch(score: number, theyTeach: string, youTeach: string): string {
  const strength = score >= 80 ? "strong" : score >= 60 ? "reasonable" : "partial";
  return (
    `A ${Math.round(score)} percent match, which is ${strength}. ` +
    `They teach ${theyTeach}, which you want to learn. ` +
    `You teach ${youTeach}, which they want to learn.`
  );
}

/** "1,240 points. That is 12 finished tasks, and level 3." */
export function describePoints(points: number, level: number): string {
  const tasks = Math.floor(points / 100);
  return (
    `${points.toLocaleString("en-IN")} points. ` +
    `That is ${tasks} finished task${tasks === 1 ? "" : "s"}, and level ${level}.`
  );
}
