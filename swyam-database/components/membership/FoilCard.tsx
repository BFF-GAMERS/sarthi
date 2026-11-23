import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { SPRING_PARAMS, useFinePointer } from "@/components/motion";
import { useTx } from "@/lib/i18n";
import type { AccentId } from "@/membership/config/plans";
import { foilStyle } from "./foil";

/** Pointer tilt, in degrees, either way. */
const TILT = 8;

export interface FoilCardProps {
  /** Embossed on the card. Their own first name, shown on their own screen only. */
  firstName: string;
  /** "Campus", "Launch" ... the product's own name for the plan. */
  planName: string;
  /** "College student" ... already translated by the caller, or a plain label. */
  roleLabel: string;
  accent: AccentId | null;
  /** No tilt, no sheen. Set for reduced motion and the lite and static effects tiers. */
  staticFx: boolean;
  /** One sheen sweep when the card first appears. Off for the Settings card, which is seen again and again. */
  sheen?: boolean;
}

/**
 * The membership card: credit-card ratio, foil face, dark ink on it in both themes.
 *
 * It tilts toward the pointer by at most 8 degrees on a spring from the motion kit, and a single
 * sheen sweeps across once. With a touch screen, reduced motion or a lightened effects tier it is a
 * still card: the same markup minus the sheen element, and no transform at all.
 */
export default function FoilCard({
  firstName,
  planName,
  roleLabel,
  accent,
  staticFx,
  sheen = true,
}: FoilCardProps) {
  const tx = useTx();
  const fine = useFinePointer();
  const tilt = fine && !staticFx;
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useSpring(rx, SPRING_PARAMS.standard);
  const sy = useSpring(ry, SPRING_PARAMS.standard);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!tilt || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(Math.max(-TILT, Math.min(TILT, px * 2 * TILT)));
    rx.set(Math.max(-TILT, Math.min(TILT, -py * 2 * TILT)));
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const label = `${tx("Swayam Plus")} ${planName}. ${tx("Demo")}.`;

  return (
    <div className="plus-foil-wrap">
      <motion.div
        ref={ref}
        className="plus-foil"
        role="img"
        aria-label={label}
        data-static={staticFx ? "" : undefined}
        data-tilt={tilt ? "" : undefined}
        style={{
          ...foilStyle(accent),
          ...(tilt ? { rotateX: sx, rotateY: sy, transformPerspective: 900 } : null),
        }}
        onPointerMove={tilt ? onMove : undefined}
        onPointerLeave={tilt ? onLeave : undefined}
      >
        <div className="plus-foil-top" aria-hidden="true">
          <span className="plus-foil-brand">Swayam Plus</span>
          <span className="plus-foil-ribbon">{tx("Demo")}</span>
        </div>
        <p className="plus-foil-name" aria-hidden="true">
          {firstName}
        </p>
        <div className="plus-foil-bottom" aria-hidden="true">
          <span className="plus-foil-plan">{planName}</span>
          <span className="plus-foil-chip">{roleLabel}</span>
        </div>
        {sheen && !staticFx && <span className="plus-sheen" aria-hidden="true" />}
      </motion.div>
    </div>
  );
}
