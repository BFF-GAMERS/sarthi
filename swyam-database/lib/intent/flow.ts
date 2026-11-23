/**
 * The steps of the "Say it" dialog as a small state machine.
 *
 * The one rule it exists to keep: the only way to reach `going` (the step that
 * carries a link to follow) is a `go` action while on `confirm`. Typing,
 * speaking, a keyword hit, a model answer and a suggestion all stop at
 * `confirm` and wait for the person to press Go.
 */
import { isAllowedHref } from "./validate";
import type { IntentResult } from "./resolve";
import { hrefForMatch, type IntentMatch } from "./routes";

export type IntentFlow =
  | { step: "ask" }
  | { step: "resolving"; phrase: string }
  | { step: "confirm"; match: IntentMatch; source: "keyword" | "ai" | "suggestion" }
  | { step: "none"; suggestions: IntentMatch[] }
  | { step: "going"; href: string };

export type IntentAction =
  | { type: "submit"; phrase: string }
  | { type: "resolved"; result: IntentResult }
  | { type: "pick"; match: IntentMatch }
  | { type: "change" }
  | { type: "go"; signedIn: boolean };

export const START: IntentFlow = { step: "ask" };

export function intentFlow(state: IntentFlow, action: IntentAction): IntentFlow {
  switch (action.type) {
    case "submit":
      return action.phrase.trim() ? { step: "resolving", phrase: action.phrase } : state;
    case "resolved":
      if (state.step !== "resolving") return state;
      return action.result.kind === "match"
        ? { step: "confirm", match: action.result.match, source: action.result.source }
        : { step: "none", suggestions: action.result.suggestions };
    case "pick":
      return state.step === "none"
        ? { step: "confirm", match: action.match, source: "suggestion" }
        : state;
    case "change":
      return state.step === "confirm" || state.step === "none" ? START : state;
    case "go": {
      if (state.step !== "confirm") return state;
      const href = hrefForMatch(state.match, action.signedIn);
      return isAllowedHref(href) ? { step: "going", href } : START;
    }
  }
}
