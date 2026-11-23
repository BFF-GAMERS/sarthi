import type { PointerEvent } from "react";
import { useMotionValue, useSpring, type HTMLMotionProps } from "framer-motion";
import { useFinePointer, useReducedMotionPref } from "./hooks";
import { motionTag, type MotionTag } from "./tags";
import { DISTANCE, SPRING, SPRING_PARAMS } from "./tokens";

export type MagneticButtonProps<T extends MotionTag> = HTMLMotionProps<T> & {
  /** The element to render. Default `button`. Use `a` for links. */
  as?: T;
  /** How much of the pointer's offset from centre the button follows. Default 0.2. */
  strength?: number;
  /** The most the button may travel from rest, in px. Default 8. */
  maxOffset?: number;
};

const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));

/**
 * A button that leans, very slightly, toward a mouse that is near it.
 *
 * It is deliberately small: at the default strength a pointer at the very
 * edge of a 200 px button pulls it about 8 px. That is enough to feel alive
 * and not enough to make it hard to hit. The pull rides the `micro` spring and
 * returns to rest when the pointer leaves; the button also gives under a
 * press.
 *
 * Only for a fine pointer with hover (a mouse or trackpad) and only when
 * reduced motion is off. Touch, pen-less tablets and keyboard users get a
 * plain button, which is also what the server renders. Keyboard focus,
 * `:focus-visible` and the hit area are never changed.
 *
 * Use it for one primary action per view, such as the adaptive hero CTA.
 * Magnetic everything is noise.
 *
 * @example
 * <MagneticButton type="button" onClick={start} className="btn-primary">Continue</MagneticButton>
 */
export function MagneticButton<T extends MotionTag = "button">({
  as,
  strength = 0.2,
  maxOffset = DISTANCE.magnet,
  onPointerMove,
  onPointerLeave,
  onPointerCancel,
  style,
  ...props
}: MagneticButtonProps<T>) {
  const tag: MotionTag = as ?? "button";
  const Tag = motionTag(tag);
  const fine = useFinePointer();
  const reduced = useReducedMotionPref();
  const active = fine && !reduced;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING_PARAMS.micro);
  const sy = useSpring(y, SPRING_PARAMS.micro);

  const rest = props as HTMLMotionProps<"button">;
  const handlers = {
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      (onPointerMove as ((e: PointerEvent<HTMLButtonElement>) => void) | undefined)?.(e);
      if (!active || e.pointerType === "touch") return;
      // Measured on every move, minus the button's own current offset, so the
      // centre it aims at is the resting centre and does not chase itself.
      const box = e.currentTarget.getBoundingClientRect();
      const cx = box.left + box.width / 2 - sx.get();
      const cy = box.top + box.height / 2 - sy.get();
      x.set(clamp((e.clientX - cx) * strength, maxOffset));
      y.set(clamp((e.clientY - cy) * strength, maxOffset));
    },
    onPointerLeave: (e: PointerEvent<HTMLButtonElement>) => {
      (onPointerLeave as ((e: PointerEvent<HTMLButtonElement>) => void) | undefined)?.(e);
      x.set(0);
      y.set(0);
    },
    onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => {
      (onPointerCancel as ((e: PointerEvent<HTMLButtonElement>) => void) | undefined)?.(e);
      x.set(0);
      y.set(0);
    },
  };

  return (
    <Tag
      {...(tag === "button" ? { type: "button" as const } : null)}
      {...(rest as HTMLMotionProps<"div">)}
      {...(handlers as unknown as HTMLMotionProps<"div">)}
      style={active ? { ...style, x: sx, y: sy } : style}
      whileTap={reduced ? { opacity: 0.85 } : { scale: 0.97 }}
      transition={SPRING.micro}
    />
  );
}
