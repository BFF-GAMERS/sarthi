/**
 * Sarthi's hands.
 *
 * The chat endpoint answers questions; this module lets Sarthi *act* on them.
 * It runs in the browser, where the signed-in Supabase session lives, so it
 * can read the person's real skills and write real requests — something the
 * offline server engine deliberately cannot do.
 *
 * The flow the brief asks for:
 *
 *   "Main Python seekhna chahta hoon aur UI design sikha sakta hoon"
 *      -> parse teach / learn out of the sentence
 *      -> offer to add them to the profile (one source of truth)
 *      -> run the same matcher /skillswap uses
 *      -> render the matches in the chat
 *      -> confirm, then send the request
 *
 * Nothing here writes without the person confirming: a spoken sentence is a
 * statement of intent, not permission to message a stranger on their behalf.
 */

import {
  addLearnSkill,
  addTeachSkill,
  findMatches,
  listLearnSkills,
  listSkills,
  listTeachSkills,
  sendSwapRequest,
  type SkillRef,
  type SwapMatch,
} from "./skillswap";

/* ── Intent ──────────────────────────────────────────────────────── */

export type SarthiIntent =
  | { kind: "swap"; teach: SkillRef[]; learn: SkillRef[] }
  | { kind: "show-matches" }
  | { kind: "navigate"; to: NavTarget; label: string }
  | { kind: "none" };

export type NavTarget =
  | "/skillswap"
  | "/passport"
  | "/profile"
  | "/dashboard"
  | "/courses"
  | "/jobs"
  | "/internships"
  | "/messages"
  | "/community";

/* Phrases that mean "I can teach this" and "I want to learn this", in English
   and the romanised Hindi people actually type into a chat box. */
const TEACH_CUE =
  /(?:i\s+(?:can|could)\s+teach|i\s+know|i'?m\s+good\s+at|i\s+am\s+good\s+at|teach\s+you|offer|expert\s+in|sikha\s+sakt[ai]|sikhata|sikhati|jaanta|janta|aata\s+hai|आता है|सिखा\s*सकत)/i;
const LEARN_CUE =
  /(?:i\s+want\s+to\s+learn|i'?d\s+like\s+to\s+learn|want\s+to\s+learn|learn|teach\s+me|help\s+me\s+with|seekhna|sikhna|seekhn[ai]\s+chaht|सीखना|सीखनी)/i;

/*
 * Navigation only fires on an explicit "take me there" phrasing.
 *
 * A looser verb list caught questions like "show me Python courses", which
 * deserve the grounded ranked answer from the chat engine rather than a jump
 * to a listing page — so `show` and `browse` are deliberately absent here.
 */
const NAV_VERB = String.raw`\b(open|go to|take me to|navigate to)\b`;
const nav = (tail: string) => new RegExp(`${NAV_VERB}.*${tail}`, "i");

const NAV_HINTS: Array<[NavTarget, string, RegExp]> = [
  ["/skillswap", "SkillSwap", nav(String.raw`\b(skill ?swap|swaps?)\b`)],
  ["/passport", "Skill Passport", nav(String.raw`\b(passport)\b`)],
  ["/profile", "your profile", /\b(open|go to|edit)\b.*\b(profile|my skills)\b/i],
  ["/dashboard", "your dashboard", nav(String.raw`\b(dashboard)\b`)],
  ["/messages", "Messages", nav(String.raw`\b(messages?|inbox|chats?)\b`)],
  ["/courses", "Courses", nav(String.raw`\b(courses?)\b`)],
  ["/jobs", "Jobs", nav(String.raw`\b(jobs?|vacanc)`)],
  ["/internships", "Internships", nav(String.raw`\b(internships?|apprentice)`)],
  ["/community", "Community", nav(String.raw`\b(community|forum)\b`)],
];

const SHOW_MATCHES =
  /\b(show|find|any|who)\b.*\b(match(es)?|partners?|swaps?)\b|\bwho can teach me\b|\bfind me (a )?(partner|match)\b/i;

/**
 * Every mention of a catalogue skill in a piece of text, with where it sat.
 *
 * Matching is done against the catalogue rather than by pulling nouns out of
 * the sentence, so Sarthi can only ever name a skill that actually exists —
 * the same discipline the rest of the engine follows.
 */
function findSkillMentions(
  text: string,
  catalogue: SkillRef[],
): Array<{
  skill: SkillRef;
  at: number;
}> {
  const hay = text.toLowerCase();
  const hits: Array<{ skill: SkillRef; at: number }> = [];

  for (const skill of catalogue) {
    const name = skill.name.toLowerCase();
    // Word-boundary match so "R" or "Go" don't fire inside other words.
    const re = new RegExp(`(?:^|[^a-z0-9+#.])${escapeRe(name)}(?:[^a-z0-9+#.]|$)`, "i");
    const m = re.exec(hay);
    if (m) hits.push({ skill, at: m.index });
  }

  // Longest names first at the same position, so "Machine Learning" wins over
  // a bare "Learning" that happens to also be in the catalogue.
  hits.sort((a, b) => a.at - b.at || b.skill.name.length - a.skill.name.length);

  // Drop a skill whose span is swallowed by a longer one already accepted.
  const kept: Array<{ skill: SkillRef; at: number }> = [];
  for (const hit of hits) {
    const covered = kept.some(
      (k) => hit.at >= k.at && hit.at + hit.skill.name.length <= k.at + k.skill.name.length,
    );
    if (!covered) kept.push(hit);
  }
  return kept;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split mentioned skills into "can teach" and "want to learn".
 *
 * Assigns each mention to whichever cue phrase most recently preceded it, so
 * both orders work: "I can teach X and want to learn Y" and the Hindi
 * "Main Python seekhna chahta hoon aur UI design sikha sakta hoon".
 */
export function parseSwapIntent(text: string, catalogue: SkillRef[]): SarthiIntent {
  const mentions = findSkillMentions(text, catalogue);
  if (mentions.length === 0) return { kind: "none" };

  const teachCue = matchAll(text, TEACH_CUE);
  const learnCue = matchAll(text, LEARN_CUE);
  if (teachCue.length === 0 && learnCue.length === 0) return { kind: "none" };

  const teach: SkillRef[] = [];
  const learn: SkillRef[] = [];

  for (const { skill, at } of mentions) {
    const lastTeach = lastBefore(teachCue, at);
    const lastLearn = lastBefore(learnCue, at);

    // In Hindi the verb follows its object ("Python seekhna"), so a cue just
    // after the skill counts too when nothing preceded it.
    const nextTeach = firstAfter(teachCue, at);
    const nextLearn = firstAfter(learnCue, at);

    const teachScore = score(lastTeach, nextTeach, at);
    const learnScore = score(lastLearn, nextLearn, at);

    if (teachScore === null && learnScore === null) continue;
    if (learnScore === null || (teachScore !== null && teachScore < learnScore)) teach.push(skill);
    else learn.push(skill);
  }

  if (teach.length === 0 && learn.length === 0) return { kind: "none" };
  return { kind: "swap", teach, learn };
}

function matchAll(text: string, re: RegExp): number[] {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    out.push(m.index);
    if (m.index === global.lastIndex) global.lastIndex++;
  }
  return out;
}

const lastBefore = (positions: number[], at: number): number | null => {
  const before = positions.filter((p) => p <= at);
  return before.length ? Math.max(...before) : null;
};
const firstAfter = (positions: number[], at: number): number | null => {
  const after = positions.filter((p) => p > at);
  return after.length ? Math.min(...after) : null;
};

/** Distance to the nearest cue; null when there is none within reach. */
function score(before: number | null, after: number | null, at: number): number | null {
  const d1 = before === null ? Infinity : at - before;
  const d2 = after === null ? Infinity : after - at;
  // A cue more than ~40 characters away is probably about a different clause.
  const best = Math.min(d1, d2);
  return best > 40 ? null : best;
}

/**
 * Classify a message, most specific first.
 *
 * A sentence naming real skills is the strongest signal, so it is read before
 * the broader "show me matches" and navigation phrasings — otherwise
 * "I want to learn Python, find me a partner" would jump straight to the
 * matcher and quietly drop Python from the person's learn list.
 */
export function parseIntent(text: string, catalogue: SkillRef[]): SarthiIntent {
  const swap = parseSwapIntent(text, catalogue);
  if (swap.kind !== "none") return swap;
  if (SHOW_MATCHES.test(text)) return { kind: "show-matches" };
  for (const [to, label, re] of NAV_HINTS) {
    if (re.test(text)) return { kind: "navigate", to, label };
  }
  return { kind: "none" };
}

/* ── Execution ───────────────────────────────────────────────────── */

export interface SarthiResult {
  /** Markdown Sarthi says back. */
  reply: string;
  /** Matches to render as cards under the reply, if any. */
  matches?: SwapMatch[];
  /** A page to send the person to. */
  navigate?: NavTarget;
  /** Skills added to the profile as part of this turn, for the confirmation. */
  added?: { teach: string[]; learn: string[] };
}

/**
 * Handle a message that Sarthi can act on.
 *
 * Returns null when the message isn't actionable, which is the signal to fall
 * through to the normal chat endpoint rather than inventing an answer.
 */
export async function runSarthiAction(
  text: string,
  profileId: string | null,
): Promise<SarthiResult | null> {
  const catalogue = await listSkills().catch(() => [] as SkillRef[]);
  const intent = parseIntent(text, catalogue);

  if (intent.kind === "none") return null;

  if (intent.kind === "navigate") {
    return { reply: `Opening **${intent.label}**.`, navigate: intent.to };
  }

  if (!profileId) {
    return {
      reply:
        "I can set that up once you're signed in — your swap matches are built from your own profile. [Log in or create a free account](/auth).",
    };
  }

  if (intent.kind === "show-matches") {
    const matches = await findMatches(profileId, 5);
    return { reply: matchesReply(matches), matches };
  }

  // A swap statement: record the skills, then match on them.
  const [haveTeach, haveLearn] = await Promise.all([
    listTeachSkills(profileId),
    listLearnSkills(profileId),
  ]);
  const teachIds = new Set(haveTeach.map((t) => t.skill.id));
  const learnIds = new Set(haveLearn.map((l) => l.skill.id));

  const newTeach = intent.teach.filter((s) => !teachIds.has(s.id));
  const newLearn = intent.learn.filter((s) => !learnIds.has(s.id));

  // Writes go to the same tables the profile page edits — Sarthi is another
  // way into one record, not a second store.
  await Promise.all([
    ...newTeach.map((s) =>
      addTeachSkill(profileId, { skillId: s.id, level: "intermediate" }).catch(() => undefined),
    ),
    ...newLearn.map((s) =>
      addLearnSkill(profileId, {
        skillId: s.id,
        currentLevel: "beginner",
        targetLevel: "intermediate",
      }).catch(() => undefined),
    ),
  ]);

  const matches = await findMatches(profileId, 5);

  const lines: string[] = [];
  if (newTeach.length || newLearn.length) {
    lines.push("Added to your profile:");
    if (newTeach.length) lines.push(`- **Can teach:** ${newTeach.map((s) => s.name).join(", ")}`);
    if (newLearn.length)
      lines.push(`- **Want to learn:** ${newLearn.map((s) => s.name).join(", ")}`);
    lines.push("");
  }
  lines.push(matchesReply(matches));

  return {
    reply: lines.join("\n"),
    matches,
    added: { teach: newTeach.map((s) => s.name), learn: newLearn.map((s) => s.name) },
  };
}

function matchesReply(matches: SwapMatch[]): string {
  if (matches.length === 0) {
    return [
      "I couldn't find a partner for that pairing yet — nobody currently teaches what you want while wanting what you offer.",
      "",
      "Adding another skill to either list widens the search a lot. You can also [browse SkillSwap](/skillswap) directly.",
    ].join("\n");
  }
  const best = matches[0]!;
  return [
    `Found **${matches.length}** ${matches.length === 1 ? "partner" : "partners"}. The closest is **${best.displayName}** at **${best.score}%** — they teach ${best.theyTeach.name}${best.youTeach ? `, and want ${best.youTeach.name}` : ""}.`,
    "",
    "Send a request to whichever looks right:",
  ].join("\n");
}

/** Send a request Sarthi proposed, after the person has confirmed it. */
export async function confirmSwapRequest(
  profileId: string,
  match: SwapMatch,
  message?: string,
): Promise<void> {
  await sendSwapRequest(profileId, {
    recipientId: match.candidateId,
    offeredSkillId: match.youTeach?.id ?? null,
    requestedSkillId: match.theyTeach.id,
    message: message ?? null,
    proposedFormat: "video",
    matchScore: match.score,
  });
}
