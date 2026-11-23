/**
 * Reason templates (plan §3.3, brief §26): every user-facing reason is rendered HERE from a
 * ReasonCode, never taken from the AI. Slots are filled only from enums and small integers, so a
 * reason can never carry an entity, search text, name or any sensitive attribute. "Describe
 * actions, never traits." Every reason is <= 160 chars and plain text.
 */
import type { BehaviourMode, DomainId, ReasonCode, Tier } from "../../types";
import type { WindowStats } from "./accumulate";
import type { Position } from "./types";

export const DOMAIN_LABEL: Readonly<Record<DomainId, string>> = {
  LEARNING: "Learning",
  CAREER: "Career",
  SKILL_EXCHANGE: "Skill exchange",
  COMMUNITY: "Community",
};

const DOMAIN_WORD: Readonly<Record<DomainId, string>> = {
  LEARNING: "learning",
  CAREER: "career",
  SKILL_EXCHANGE: "skill exchange",
  COMMUNITY: "community",
};

export const MODE_HEAD: Readonly<Record<BehaviourMode, string>> = {
  BALANCED: "Home shortcuts reset",
  REPEAT: "Where you left off comes first",
  RESEARCH: "Compare and filter tools are up front",
  QUICK: "Shortcuts come first",
  MINIMAL: "A simpler Home",
  EXPLORER: "More to discover up front",
  CAREER_FOCUSED: "Your applications come first",
  LEARNING_FOCUSED: "Your courses come first",
  SKILL_FOCUSED: "Your skill matches come first",
};

const MODE_FACT: Readonly<Record<BehaviourMode, string>> = {
  BALANCED: "your recent activity changed",
  REPEAT: "you often return to the same things",
  RESEARCH: "you compare and filter before you decide",
  QUICK: "you get things done in a few taps",
  MINIMAL: "your visits are short and to the point",
  EXPLORER: "you use several parts of Swayam",
  CAREER_FOCUSED: "you follow through on applications",
  LEARNING_FOCUSED: "you follow through on courses",
  SKILL_FOCUSED: "you follow through on skill swaps",
};

const dom = (code: ReasonCode): DomainId | null => {
  const d = code.slots?.["domain"];
  return typeof d === "string" && d in DOMAIN_LABEL ? (d as DomainId) : null;
};
const mode = (code: ReasonCode): BehaviourMode => {
  const m = code.slots?.["mode"];
  return typeof m === "string" && m in MODE_HEAD ? (m as BehaviourMode) : "BALANCED";
};

/** Local template text for a reason code (never the AI's words). */
export function renderReason(code: ReasonCode): string {
  const d = dom(code);
  const label = d ? DOMAIN_LABEL[d] : "This";
  switch (code.key) {
    case "START":
      return "Learning how you use Swayam.";
    case "DOMAIN_RISING":
      return `${label} moved up. Most of your recent activity is there.`;
    case "DOMAIN_CONFIRMED":
      return `${label} is now in your menu. You keep coming back to it.`;
    case "DOMAIN_DEEPENED":
      return `${label} gets more room on Home. You use it across visits.`;
    case "DOMAIN_SOFTENED":
      return `${label} eased back a little. You have been using other parts of Swayam too.`;
    case "RETURN_TO_BALANCED":
      return "Back to the everyday layout. Your recent activity is spread out.";
    case "EXPLORER_BREADTH": {
      const n = Number(code.slots?.["count"] ?? 0);
      return n > 0
        ? `More to discover up front. You have used ${n} different areas.`
        : "More to discover up front. You use several parts of Swayam.";
    }
    case "MODE_OVERLAY": {
      const m = mode(code);
      return `${MODE_HEAD[m]}. ${cap(MODE_FACT[m])}.`;
    }
    case "RESTORED":
      return "Welcome back. Swayam kept the arrangement from your last visits.";
    case "AI_REFINED":
      return "Fine-tuned from your recent activity.";
    case "RESET":
      return "Fresh start. Swayam is back to its balanced layout.";
    case "UNDO":
      return "Back to your previous layout. Swayam will not make that change again this session.";
    case "PERSONA":
      return "A demo journey arranged this layout.";
    case "LOCKED":
      return "Your layout is locked. Swayam keeps it as it is.";
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The reason code for a visible change (first matching row wins). */
export function reasonFor(from: Position, to: Position, ws: WindowStats): ReasonCode {
  const f = from.P;
  const p = to.P;
  if (f !== null && p === null) return { key: "RETURN_TO_BALANCED" };
  if (f === null && p !== null) return { key: "DOMAIN_RISING", slots: { domain: p } };
  if (p !== null && to.ptier < from.ptier) return { key: "DOMAIN_SOFTENED", slots: { domain: p } };
  if (p !== null && to.ptier === 2 && from.ptier === 1)
    return { key: "DOMAIN_CONFIRMED", slots: { domain: p } };
  if (p !== null && to.ptier === 3 && from.ptier === 2 && to.mode === from.mode)
    return { key: "DOMAIN_DEEPENED", slots: { domain: p } };
  if (to.mode !== from.mode) {
    if (p === null && to.mode === "EXPLORER")
      return { key: "EXPLORER_BREADTH", slots: { count: ws.domains } };
    return { key: "MODE_OVERLAY", slots: { mode: to.mode } };
  }
  return p !== null
    ? { key: "DOMAIN_DEEPENED", slots: { domain: p } }
    : { key: "RETURN_TO_BALANCED" };
}

export const TIER_WORDS: Readonly<Record<Tier, string>> = {
  0: "This may help",
  1: "This may help",
  2: "You often do this",
  3: "You almost always do this",
};

export { DOMAIN_WORD };
