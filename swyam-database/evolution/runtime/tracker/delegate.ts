/**
 * The one optional delegated listener: capture-phase click on the document. It finds
 * closest('[data-track]'), skips disabled controls and anything inside [data-track-scope="off"],
 * and forwards to track() (which honours suspendTracking and the engine's sanitiser).
 * Started by subscribeRouteEvents, which EvolutionRuntime already calls once.
 */
import { TRACK_ATTR, parseTrackAttrs } from "./track-attrs";
import { track } from "./track";

function isDisabled(el: Element): boolean {
  return el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled === true;
}

/** Handles one click target; exported for tests. Returns true when an event was queued. */
export function handleTrackTarget(target: EventTarget | null): boolean {
  try {
    if (!target || typeof (target as Element).closest !== "function") return false;
    const el = (target as Element).closest(`[${TRACK_ATTR.type}]`);
    if (!el || isDisabled(el) || el.closest(`[${TRACK_ATTR.scopeOff}="off"]`)) return false;
    const parsed = parseTrackAttrs(el);
    if (!parsed) return false;
    track(parsed.type, parsed.metadata as never, {
      entityId: parsed.entityId,
      service: parsed.service,
    });
    return true;
  } catch {
    return false;
  }
}

export function startDelegate(): () => void {
  if (typeof document === "undefined") return () => {};
  const onClick = (e: Event) => {
    handleTrackTarget(e.target);
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener("click", onClick, opts);
  return () => document.removeEventListener("click", onClick, opts);
}
