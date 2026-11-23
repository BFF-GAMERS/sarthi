import type { HTMLMotionProps, Variants } from "framer-motion";
import { useMotionPrefs } from "./hooks";
import { motionTag, type MotionTag } from "./tags";
import { DISTANCE, DURATION, SPRING, fade } from "./tokens";

/**
 * Where a revealing block starts from.
 *
 * Opacity does not start at zero. The existing `Reveal` removed its fade for a
 * reason that applies here: a block that begins fully transparent is gone
 * for good if animation frames never arrive (a background tab, a stalled
 * main thread), and it is also invisible in server-rendered HTML, which costs
 * Largest Contentful Paint. Starting at half opacity and 16px low still reads
 * as an entrance, and fails honestly.
 */
const FROM_OPACITY = 0.5;

type RevealOptions = {
  /** Seconds before the reveal starts. */
  delay?: number;
  /** How far below its place the block starts, in px. Default 16. */
  distance?: number;
  /** Opacity it starts from. Default 0.5; see the note above before using 0. */
  fromOpacity?: number;
};

function revealVariants(
  { delay = 0, distance = DISTANCE.reveal, fromOpacity = FROM_OPACITY }: RevealOptions,
  reduced: boolean,
): Variants {
  return {
    hidden: { opacity: fromOpacity, y: reduced ? 0 : distance },
    show: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? fade(DURATION.base, delay)
        : { delay, y: SPRING.major, opacity: fade(DURATION.slow) },
    },
  };
}

export type RevealOnViewProps<T extends MotionTag> = Omit<
  HTMLMotionProps<T>,
  "variants" | "initial" | "animate" | "whileInView" | "viewport"
> &
  RevealOptions & {
    /** The element to render. Default `div`. */
    as?: T;
    /**
     * Turns this element into an orchestrator for `RevealItem` children, which
     * then rise one after another this many seconds apart (0.06 to 0.1 reads
     * well). The container itself does not move. Omit to reveal this element
     * on its own.
     */
    stagger?: number;
  };

/**
 * Reveals its content as it scrolls into view, once.
 *
 * On its own it is a single element rising into place. With `stagger` it
 * orchestrates `RevealItem` children (a grid of cards, a list of
 * steps), each following the last by a fixed gap, so a row of cards arrives as
 * one gesture rather than all at once. It fires the first time 20% of the
 * element is on screen and never again, so scrolling back does not replay it
 * and a section that the Evolution Engine later moves does not re-animate.
 *
 * Under reduced motion the block only fades. If the page was opened in a
 * hidden tab, it shows its finished state. In server-rendered HTML the block
 * is already visible (half opacity, slightly low), never missing.
 *
 * Do not wrap an `EvolutionStage` item's whole content in this when the item
 * can be promoted: a section that reveals and glides at once moves twice.
 * Reveal the things *inside* sections, not the sections themselves.
 *
 * @example
 * <RevealOnView stagger={0.08} className="grid gap-4 sm:grid-cols-3">
 *   {cards.map((c) => <RevealItem key={c.id}><Card {...c} /></RevealItem>)}
 * </RevealOnView>
 */
export function RevealOnView<T extends MotionTag = "div">({
  as,
  stagger,
  delay = 0,
  distance,
  fromOpacity,
  ...props
}: RevealOnViewProps<T>) {
  const { reduced, frozen } = useMotionPrefs();
  const Tag = motionTag(as ?? "div");

  const variants: Variants =
    stagger === undefined
      ? revealVariants({ delay, distance, fromOpacity }, reduced)
      : { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } };

  return (
    <Tag
      {...(props as HTMLMotionProps<"div">)}
      variants={variants}
      initial="hidden"
      // A hidden tab gets no frames: ask for the finished state outright.
      animate={frozen ? "show" : undefined}
      whileInView="show"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -6% 0px" }}
    />
  );
}

export type RevealItemProps<T extends MotionTag> = Omit<
  HTMLMotionProps<T>,
  "variants" | "initial" | "animate" | "whileInView" | "viewport"
> &
  Omit<RevealOptions, "delay"> & {
    /** The element to render. Default `div`. */
    as?: T;
  };

/**
 * A child of `<RevealOnView stagger>`. It rises when its parent says so, in
 * turn. Outside a `RevealOnView` it renders as a plain element, so it is safe
 * to use in a component that is sometimes revealed and sometimes not.
 */
export function RevealItem<T extends MotionTag = "div">({
  as,
  distance,
  fromOpacity,
  ...props
}: RevealItemProps<T>) {
  const { reduced } = useMotionPrefs();
  const Tag = motionTag(as ?? "div");
  return (
    <Tag
      {...(props as HTMLMotionProps<"div">)}
      variants={revealVariants({ distance, fromOpacity }, reduced)}
    />
  );
}
