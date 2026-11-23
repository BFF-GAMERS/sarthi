import type { HTMLMotionProps } from "framer-motion";
import { useReducedMotionPref } from "./hooks";
import { motionTag, type MotionTag } from "./tags";
import { SPRING } from "./tokens";

export interface PressOptions {
  /** Scale while pressed. Buttons 0.97 (default), large cards 0.985. */
  scale?: number;
  /** Turns the effect off, e.g. for a disabled control. */
  disabled?: boolean;
}

/**
 * Props that make any `motion.*` element give under a finger or a click.
 *
 * Use it directly when the element is already a motion component:
 *
 *   const press = usePressProps();
 *   <motion.button {...press}>Save</motion.button>
 *
 * Under reduced motion the press dims the element to 85% instead of scaling
 * it, so there is still feedback and nothing moves.
 *
 * Careful on non-interactive elements: framer-motion makes any element with a
 * press gesture a tab stop (`tabindex="0"`) unless it already has a `tabindex`.
 * On a `div` or `article` that is a focusable thing with no role, so pass
 * `tabIndex={-1}` there. `PressScale` does that for you.
 */
export function usePressProps({ scale = 0.97, disabled = false }: PressOptions = {}) {
  const reduced = useReducedMotionPref();
  return {
    whileTap: disabled ? undefined : reduced ? { opacity: 0.85 } : { scale },
    transition: SPRING.micro,
  } as const;
}

export type PressScaleProps<T extends MotionTag> = HTMLMotionProps<T> &
  PressOptions & {
    /** The element to render. Default `div`. */
    as?: T;
  };

/**
 * A press that feels physical: the element settles to 97% on pointer-down and
 * springs back on release. The `micro` spring is quick enough that the
 * release is done before the click handler's result is on screen.
 *
 * It renders the element itself (no wrapper), so layout, `:focus-visible`
 * and semantics are untouched. Keyboard activation (Enter) triggers the same
 * press for focusable elements. Everything else you pass through is spread
 * onto the element, and your own `whileTap` or `transition` wins.
 *
 * @example
 * <PressScale as="button" type="button" onClick={save} className="btn">Save</PressScale>
 */
export function PressScale<T extends MotionTag = "div">({
  as,
  scale,
  disabled,
  ...props
}: PressScaleProps<T>) {
  const tag: MotionTag = as ?? "div";
  const Tag = motionTag(tag);
  const press = usePressProps({ scale, disabled });
  // Buttons and links are focusable already; anything else must not become a
  // tab stop just because it can be pressed (see `usePressProps`).
  const inert = tag === "button" || tag === "a" ? null : { tabIndex: -1 };
  return <Tag {...press} {...inert} {...(props as HTMLMotionProps<"div">)} />;
}
