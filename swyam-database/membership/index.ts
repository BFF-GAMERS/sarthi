/**
 * Swayam Plus membership: the public API for the UI (lane B4) and the Lab.
 *
 *   const m = useMembership();   // { plan, benefits, headline, accent, reason, source, ready, ... }
 *   const p = usePlusState();    // { state, markShown, dismiss, setInterest, update }
 *   recordPlusEvent("plus_shown", { moment, planId, source });
 *
 * The plan is a lookup on the declared profile type; the AI only orders the plan's own benefits. Nothing
 * existing is gated, every plan is a demo (no payment taken), and a guest has no plan. The server side
 * (src/membership/server/*) is deliberately not re-exported: import it from the route only.
 */
export * from "./config/plans";
export * from "./config/events";
export * from "./core/types";
export {
  buildChooserInput,
  cacheKeyOf,
  fallbackChoice,
  inputKeyOf,
  isAiEnabled,
  isPlanProfileType,
  planForType,
  resolveChoice,
  roundDomain,
  validateChoice,
} from "./core/chooser";
export type { ResolvedChoice } from "./core/chooser";
export {
  SNOOZE_FIRST_MS,
  SNOOZE_REPEAT_MS,
  applyDismiss,
  applyInterest,
  applyShown,
  isSnoozed,
  parsePlusState,
  resetForRoleChange,
} from "./core/plus-state";
export { onPlusEvent, readPlusEvents, recordPlusEvent } from "./state/events";
export { useMembership, usePlusState } from "./state/hooks";
export type { Membership, PlusStateApi } from "./state/hooks";
