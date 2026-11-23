import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useFinePointer, useReducedMotionPref } from "./hooks";
import { motionTag, type MotionTag } from "./tags";
import { DISTANCE, SPRING } from "./tokens";

export type HoverLiftProps<T extends MotionTag> = HTMLMotionProps<T> & {
  /** The element to render. Default `div`. */
  as?: T;
  /** How far the card rises on hover, in px. Default 4. */
  lift?: number;
  /**
   * Also give under a press. A number is the pressed scale (0.985 suits a
   * card); omit for none. Ignored on touch and under reduced motion.
   */
  press?: number;
};

/**
 * A card that rises a few pixels under a mouse and gains a soft shadow.
 *
 * The lift is `transform`. The shadow is not animated at all: a separate
 * layer behind the card already carries the theme's `--shadow-float` and only
 * its `opacity` changes. Both stay on the compositor, so a grid of forty
 * cards hovers at full frame rate. It also means the shadow follows the
 * theme: soft in the dark register, a hairline-only "none" in the paper one.
 *
 * It renders nothing special unless the device has a hover-capable fine
 * pointer and reduced motion is off. On touch `:hover` sticks after a tap and
 * would leave a card raised, so there it is a plain element. That decision is
 * made after hydration, so the server markup is always the plain one.
 *
 * The wrapper is the card: give it the card's `className` (background,
 * border, radius). The shadow layer inherits the radius.
 *
 * @example
 * <HoverLift as="article" className="rounded-2xl border bg-card p-5">...</HoverLift>
 */
export function HoverLift<T extends MotionTag = "div">({
  as,
  lift = DISTANCE.lift,
  press,
  className,
  children,
  ...props
}: HoverLiftProps<T>) {
  const tag: MotionTag = as ?? "div";
  const Tag = motionTag(tag);
  const fine = useFinePointer();
  const reduced = useReducedMotionPref();
  const enabled = fine && !reduced;

  const rest = props as HTMLMotionProps<"div">;
  if (!enabled) {
    return (
      <Tag {...rest} className={className}>
        {children as HTMLMotionProps<"div">["children"]}
      </Tag>
    );
  }

  return (
    <Tag
      {...rest}
      // `isolate` keeps the shadow layer's negative z-index inside this card.
      className={`relative isolate ${className ?? ""}`}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={press ? { scale: press } : undefined}
      // A press gesture would make a plain card a tab stop; see `usePressProps`.
      {...(press && tag !== "button" && tag !== "a" ? { tabIndex: -1 } : null)}
      variants={{ rest: { y: 0 }, hover: { y: -lift } }}
      transition={SPRING.micro}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
        style={{ boxShadow: "var(--shadow-float)" }}
        variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={SPRING.standard}
      />
      {children as ReactNode}
    </Tag>
  );
}
