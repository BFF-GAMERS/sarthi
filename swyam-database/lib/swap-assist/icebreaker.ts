/**
 * Icebreaker drafts for a swap request.
 *
 * Pure and deterministic: three short templates (warm, brief, curious) filled
 * from the two skill names, and the two skill levels when the caller has them.
 * No profile data goes in (no names, places, headlines), so a draft carries
 * nothing the sender could not already see on the card.
 *
 * A draft is only ever offered as a suggestion that is inserted into the
 * editable message box. Nothing here sends anything.
 *
 * `tx` is the site's whole-string translator (`useTx()`); every template is
 * passed through it as a literal so it is translated like any other string,
 * Hinglish included. Placeholders are filled after translation.
 */

export type IcebreakerTone = "warm" | "brief" | "curious";

export const ICEBREAKER_TONES: readonly IcebreakerTone[] = ["warm", "brief", "curious"];

export const MAX_SKILL_CHARS = 40;
export const MAX_DRAFT_CHARS = 280;

export interface IcebreakerInput {
  /** The skill you want to learn (what they would teach you). */
  learnSkill: string;
  /** The skill you would teach back, if you have one to offer. */
  teachSkill?: string | null;
  /** Your own level in `learnSkill`, when known. */
  learnLevel?: string | null;
}

export interface IcebreakerDraft {
  tone: IcebreakerTone;
  label: string;
  text: string;
}

type Tx = (english: string) => string;

/** A skill name made safe to drop into a sentence: text only, one line, bounded. */
export function cleanSkill(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SKILL_CHARS)
      .trim()
  );
}

/** Replaces `{name}` placeholders. A function replacer, so `$&` in a skill name stays literal. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : whole,
  );
}

function levelWord(level: string | null | undefined, tx: Tx): string | null {
  switch (typeof level === "string" ? level.trim().toLowerCase() : "") {
    case "beginner":
      return tx("beginner");
    case "intermediate":
      return tx("intermediate");
    case "advanced":
      return tx("advanced");
    case "expert":
      return tx("expert");
    default:
      return null;
  }
}

const join = (parts: Array<string | null>): string =>
  parts
    .filter((p): p is string => !!p)
    .join(" ")
    .slice(0, MAX_DRAFT_CHARS);

/** The three drafts, or none when there is no skill to talk about. */
export function buildIcebreakers(input: IcebreakerInput, tx: Tx): IcebreakerDraft[] {
  const learn = cleanSkill(input.learnSkill);
  if (!learn) return [];
  const teach = cleanSkill(input.teachSkill);
  const level = levelWord(input.learnLevel, tx);
  const vars = { learn, teach, level: level ?? "" };

  const warm = join([
    fill(tx("Hi! I'd love to learn {learn} from you."), vars),
    level ? fill(tx("I'm at {level} level, so I'm happy to start from the basics."), vars) : null,
    teach ? fill(tx("I can teach you {teach} in return."), vars) : null,
    tx("Would a short first chat work for you?"),
  ]);

  const brief = teach
    ? join([fill(tx("Hi! Want to swap {teach} for {learn}?"), vars)])
    : join([fill(tx("Hi! Could you teach me {learn}?"), vars)]);

  const curious = join([
    fill(tx("Hi! What got you into {learn}? I'd love to learn it from you."), vars),
    teach ? fill(tx("I can share {teach} in return."), vars) : null,
  ]);

  return [
    { tone: "warm", label: tx("Warm"), text: warm },
    { tone: "brief", label: tx("Brief"), text: brief },
    { tone: "curious", label: tx("Curious"), text: curious },
  ];
}

const BREAK = "\n\n";

/**
 * What the message box holds after a chip is tapped.
 *
 * An empty box takes the draft. If the box still ends with the previous
 * suggestion, that suggestion is swapped for the new one. Anything else the
 * person typed is kept and the draft goes underneath it, so tapping a chip
 * never throws their words away.
 */
export function applyDraft(current: string, draft: string, lastInserted?: string | null): string {
  if (!current.trim()) return draft;
  if (lastInserted && current.endsWith(lastInserted)) {
    const head = current.slice(0, current.length - lastInserted.length).trimEnd();
    return head ? head + BREAK + draft : draft;
  }
  return current.trimEnd() + BREAK + draft;
}
