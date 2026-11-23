import { useEffect, useRef } from "react";
import { usePreferences } from "../context/PreferencesContext";

/**
 * The Gen Z ground.
 *
 * Millennial mode gets paper: a flat, printed surface that should sit still.
 * Gen Z mode gets depth instead — light sources at different distances that
 * lean with the pointer, tilt with the phone, and take a short knock when you
 * tap. It is the same content either way; only the room it sits in changes.
 *
 * Everything moves by transform alone, on a layer that never takes a pointer
 * event, so nothing here can cost a layout or swallow a click. It removes
 * itself entirely in Millennial mode and for anyone who asked for less motion
 * — this is exactly the kind of effect that setting exists to stop.
 *
 * Three things the field does, in order of how strongly they read:
 *
 *   1. A light travels with the pointer. The distant orbs lag heavily, which
 *      is what sells the depth, but nothing tracked closely enough to feel
 *      attached to the cursor — so the whole field read as ambient wallpaper
 *      rather than as a response. `.df-cursor` closes that gap.
 *   2. The field brightens when the pointer is over something you can act on.
 *      Hovering a card or a button lifts the light and widens the orbs'
 *      travel, so the room answers the same moment the component does.
 *   3. A short knock on tap, for the phones that have no pointer at all.
 */

/** How far each layer travels, in pixels, at full pointer deflection. */
const LAYERS = [
  { className: "df-orb df-orb-a", depth: 46 },
  { className: "df-orb df-orb-b", depth: -34 },
  { className: "df-orb df-orb-c", depth: 22 },
  { className: "df-grid", depth: -12 },
];

/**
 * What counts as "you could click this".
 *
 * Checked with `closest`, so hovering the text inside a card still lights the
 * field — the thing being hovered is the card, not the paragraph.
 *
 * Two things are deliberately NOT in this list, and leaving them in made the
 * whole effect meaningless: sampling the viewport on a grid found 96% of it
 * counting as interactive.
 *
 *   [tabindex]  — the skip-link target is `<main tabindex="-1">`, which covers
 *                 the entire page. A focus target is not something you click.
 *   .panel      — panels are page sections, several of them screen-sized.
 *
 * `.card` stays: a card is card-sized, and it is the thing people actually
 * point at.
 */
const INTERACTIVE = 'a, button, .card, input, select, textarea, [role="button"]';

export default function DepthField() {
  const { prefs } = usePreferences();
  const on = prefs.interfaceMode === "genz" && !prefs.reducedMotion;

  const rootRef = useRef<HTMLDivElement>(null);
  // Where the pointer is (-1..1), and where the layers have got to so far.
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  // The same pointer in viewport pixels, for the light that tracks it closely.
  const point = useRef({ x: -9999, y: -9999 });
  const lit = useRef({ x: -9999, y: -9999 });
  // 0 at rest, 1 while the pointer is over something interactive.
  const heat = useRef({ target: 0, current: 0 });
  const frame = useRef(0);

  useEffect(() => {
    if (!on) return;
    const root = rootRef.current;
    if (!root) return;

    const onPointer = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      point.current = { x: e.clientX, y: e.clientY };
    };

    /*
     * Hover, as the field sees it.
     *
     * `pointerover` fires when the pointer crosses into a different element
     * rather than on every move, so this is a handful of calls per second at
     * most — cheap enough to run a `closest` in.
     */
    const onOver = (e: PointerEvent) => {
      const el = e.target as Element | null;
      heat.current.target = el?.closest?.(INTERACTIVE) ? 1 : 0;
    };
    // Leaving the window entirely has to cool it; otherwise the field stays
    // lit at whatever it was when the pointer left the page.
    const onLeave = () => {
      heat.current.target = 0;
      point.current = { x: -9999, y: -9999 };
    };

    // Phones have no pointer to follow, so the handset itself becomes one.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      target.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 35)),
        y: Math.max(-1, Math.min(1, (e.beta - 45) / 35)),
      };
    };

    // A knock, not a bounce: one short shake, then back to rest.
    const onTap = (e: PointerEvent) => {
      // A tap is also a hover on a touchscreen, where `pointerover` may never
      // fire on its own. Without this the field never lights on a phone.
      const el = e.target as Element | null;
      if (el?.closest?.(INTERACTIVE)) heat.current.target = 1;

      root.classList.remove("df-rumble");
      // Reading offsetWidth restarts the animation; without it a second tap
      // inside the same second does nothing.
      void root.offsetWidth;
      root.classList.add("df-rumble");
    };

    /**
     * Ease toward the pointer rather than snapping to it.
     *
     * Three different rates on purpose, because they are three different
     * distances. The orbs lag heavily (0.06) and read as something big and
     * far away. The cursor light is nearly attached (0.16) — that closeness
     * is the whole point of it. The heat sits between them, so the field
     * brightens promptly on entering a card and fades gently on leaving,
     * which is the asymmetry that stops it flickering across a grid of them.
     */
    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;

      const l = lit.current;
      const p = point.current;
      l.x += (p.x - l.x) * 0.16;
      l.y += (p.y - l.y) * 0.16;

      const h = heat.current;
      h.current += (h.target - h.current) * (h.target > h.current ? 0.12 : 0.05);

      const s = root.style;
      s.setProperty("--px", c.x.toFixed(4));
      s.setProperty("--py", c.y.toFixed(4));
      s.setProperty("--mx", l.x.toFixed(1));
      s.setProperty("--my", l.y.toFixed(1));
      s.setProperty("--hot", h.current.toFixed(3));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onTap, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("blur", onLeave);
    window.addEventListener("deviceorientation", onTilt);

    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onTap);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [on]);

  if (!on) return null;

  return (
    <div ref={rootRef} className="depth-field" aria-hidden>
      {LAYERS.map((l) => (
        <span
          key={l.className}
          className={l.className}
          style={{ ["--depth" as string]: `${l.depth}px` }}
        />
      ))}
      {/* Last, so it sits above the orbs and the grid it is lighting. */}
      <span className="df-cursor" />
    </div>
  );
}
