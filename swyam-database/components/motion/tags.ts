import { motion } from "framer-motion";

/** The elements the polymorphic primitives can render as. */
export type MotionTag = "div" | "span" | "button" | "a" | "li" | "article" | "section";

/** The one component type every tag below is cast to, so JSX stays simple. */
export type AnyMotionComponent = typeof motion.div;

const TAGS: Record<MotionTag, unknown> = {
  div: motion.div,
  span: motion.span,
  button: motion.button,
  a: motion.a,
  li: motion.li,
  article: motion.article,
  section: motion.section,
};

/**
 * Looks up `motion.<tag>`.
 *
 * Primitives take an `as` prop so a card can be an `<article>` and a nav item
 * an `<li>` without a wrapper element. TypeScript cannot check JSX over a
 * union of seven component types, so this returns them as one; the public
 * props are typed per tag by `HTMLMotionProps<T>` on each primitive instead.
 */
export function motionTag(tag: MotionTag): AnyMotionComponent {
  return TAGS[tag] as AnyMotionComponent;
}
