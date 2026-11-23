/**
 * A skippable 30-minute plan for a first swap session.
 *
 * Five fixed steps (5 + 10 + 10 + 3 + 2) personalised only with the two skill
 * names. It is a suggestion shown once when a swap is accepted; the person can
 * skip it, or ask not to see it again (a flag on this device only).
 *
 * `tx` is the site's whole-string translator; templates are literals so they
 * are translated like any other string. Placeholders are filled afterwards.
 */
import { cleanSkill } from "./icebreaker";

type Tx = (english: string) => string;

export type PlaybookStepId = "hello" | "turn-1" | "turn-2" | "recap" | "next";

export interface PlaybookStep {
  id: PlaybookStepId;
  minutes: number;
  title: string;
  tip: string;
}

export interface Playbook {
  totalMinutes: number;
  steps: PlaybookStep[];
}

export interface PlaybookInput {
  /** The skill you teach in this swap. */
  teachSkill?: string | null;
  /** The skill you learn in this swap; null for a one-way request. */
  learnSkill?: string | null;
}

const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : whole,
  );

export function buildPlaybook(input: PlaybookInput, tx: Tx): Playbook {
  const teach = cleanSkill(input.teachSkill) || tx("your skill");
  const learn = cleanSkill(input.learnSkill);
  const vars = { teach, learn };

  const steps: PlaybookStep[] = [
    {
      id: "hello",
      minutes: 5,
      title: tx("Say hello and set goals"),
      tip: tx("Each of you says in one sentence what you want from today."),
    },
    {
      id: "turn-1",
      minutes: 10,
      title: fill(tx("You teach {teach}"), vars),
      tip: tx("Show one small thing they can try straight away, then ask them to repeat it back."),
    },
    learn
      ? {
          id: "turn-2",
          minutes: 10,
          title: fill(tx("They teach {learn}"), vars),
          tip: tx("Ask questions, and try the first step yourself while they watch."),
        }
      : {
          id: "turn-2",
          minutes: 10,
          title: fill(tx("Practice {teach} together"), vars),
          tip: tx("Swap roles: you try, they coach. Note what felt tricky."),
        },
    {
      id: "recap",
      minutes: 3,
      title: tx("Recap together"),
      tip: tx("Each of you names one thing you learned and one thing to practice."),
    },
    {
      id: "next",
      minutes: 2,
      title: tx("Pick the next step"),
      tip: tx("Choose a time for the next session and one thing to try before then."),
    },
  ];

  return { totalMinutes: steps.reduce((n, s) => n + s.minutes, 0), steps };
}

/* ── "Don't show again", on this device only ─────────────────────── */

export const PLAYBOOK_HIDE_KEY = "swayam-swap-playbook-hidden";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(given?: Store): Store | null {
  if (given) return given;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** True when the person asked not to see the plan after an accept. Storage that throws counts as "show". */
export function isPlaybookHidden(given?: Store): boolean {
  try {
    return store(given)?.getItem(PLAYBOOK_HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hidePlaybookForever(given?: Store): void {
  try {
    store(given)?.setItem(PLAYBOOK_HIDE_KEY, "1");
  } catch {
    /* private mode or full: the plan simply shows next time */
  }
}

export function showPlaybookAgain(given?: Store): void {
  try {
    store(given)?.removeItem(PLAYBOOK_HIDE_KEY);
  } catch {
    /* nothing to undo */
  }
}
