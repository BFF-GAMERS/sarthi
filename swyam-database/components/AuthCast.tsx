import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The cast on the sign-in panel.
 *
 * What stood here was a stock photograph of an electronics lab at 18% opacity
 * under a gradient — a picture of a place nobody on this site has been, doing
 * the work of a texture. This is drawn instead: four characters, in the
 * platform's own colours, waiting on the other side of the form.
 *
 * They are shapes rather than people on purpose. A face on a sign-in screen
 * belongs to somebody, and every somebody a stock library sells is the wrong
 * age, the wrong trade or the wrong state for most of the people who will read
 * this page. A dome and three slabs belong to nobody and so leave room for
 * everybody.
 *
 * They watch the form, and that is the part worth keeping. Their eyes cut to
 * whichever field has the caret, and they shut them the moment the password is
 * put on screen in plain text — the reveal is the only time there is anything
 * to see, so it is the only time looking away means something. Masked, there
 * is nothing to be discreet about and they watch as usual.
 *
 * The eyes travel to where they are looking over a second and a half, which
 * is slow enough to watch happen. What they do not do any more is creep a
 * pixel per keystroke: the offset is fixed and the move is one deliberate
 * turn, not a hundred small ones.
 *
 * The characters drift sideways as well as bobbing, each on its own period,
 * long enough and out of step enough that the group never visibly loops.
 *
 * Sized to the panel, not to a comfortable drawing. The first cut was a
 * 358×184 strip — almost two to one — dropped into a panel that is very
 * nearly square, so the width bound first and the characters came out small
 * with a band of dead ink above and below them. The box is 320×280 now: the
 * aspect ratio of the artwork is what decides how big anything can be, not
 * the size the artwork is asked to render at.
 *
 * Depth is a gradient and a shadow, not a 3D transform. The lesson written
 * beside the form applies here too: this is the one screen a person cannot
 * route around, so nothing on it is allowed to be expensive or fragile.
 *
 * Everything is decorative, `aria-hidden`, and outside the tab order. Nothing
 * starts at `opacity: 0` — a frame that never arrives leaves the panel looking
 * composed rather than empty — and under reduced motion the whole cast holds
 * still and simply shows the mood as a pose.
 */

/** The line they all stand on. */
const GROUND = 246;

/** What the cast is doing, decided by what the form is doing. */
export type CastMood = "idle" | "watching" | "hiding" | "cheering";

/** One character: body geometry, colour, and the rhythm it moves to. */
const CAST = [
  {
    id: "dome",
    /** The big one. A half-round, so the group has a base to sit against. */
    shape: "dome" as const,
    x: 66,
    y: GROUND,
    w: 126,
    h: 100,
    fill: "url(#cast-saffron)",
    eye: "#14161f",
    eyes: [
      [-22, -38],
      [18, -38],
    ],
    /** Rest, mouth shut while hiding, open wide while cheering. */
    mouth: {
      idle: "M -14 -14 q 14 14 28 0",
      hiding: "M -12 -10 q 12 4 24 0",
      cheering: "M -16 -16 q 16 22 32 0",
    },
    /*
      The only limb in the cast, and it belongs to the dome.

      It lives on the character rather than beside it so that it rises with
      the bob; drawn as a sibling it stayed put while its owner hopped, which
      read as a stray mark rather than an arm. `ox`/`oy` are the shoulder, so
      the wave pivots where an arm would, and the reach stops short of the
      slab beside it — an arm that overlaps the next character reads as a
      line drawn across its face.
    */
    arm: { d: "M 122 206 q 18 -6 26 -30", ox: 122, oy: 206, colour: "#cf3a0b" },
    sway: 7,
    swayDur: 9.3,
    bob: 11,
    dur: 5.2,
    delay: 0,
    blink: 4.6,
  },
  {
    id: "slab",
    /** Tall and narrow, the counterweight to the dome. */
    shape: "slab" as const,
    x: 190,
    y: GROUND,
    w: 62,
    h: 186,
    fill: "url(#cast-indigo)",
    eye: "#f7f5f0",
    eyes: [
      [-13, -146],
      [13, -146],
    ],
    mouth: null,
    arm: null,
    sway: -6,
    swayDur: 11.7,
    bob: 15,
    dur: 6.4,
    delay: 0.8,
    blink: 5.8,
  },
  {
    id: "stub",
    shape: "slab" as const,
    x: 250,
    y: GROUND,
    w: 50,
    h: 100,
    fill: "url(#cast-ink)",
    eye: "#f7f5f0",
    eyes: [
      [-11, -70],
      [11, -70],
    ],
    mouth: null,
    arm: null,
    sway: 5,
    swayDur: 8.1,
    bob: 9,
    dur: 4.4,
    delay: 1.6,
    blink: 3.9,
  },
  {
    id: "chip",
    /** Overlaps the one behind it by a hair, which is what puts it in front. */
    shape: "slab" as const,
    x: 294,
    y: GROUND,
    w: 42,
    h: 64,
    fill: "url(#cast-marigold)",
    eye: "#14161f",
    eyes: [
      [-9, -40],
      [9, -40],
    ],
    mouth: null,
    arm: null,
    sway: -8,
    swayDur: 10.4,
    bob: 13,
    dur: 3.8,
    delay: 0.4,
    blink: 6.7,
  },
];

/** Sparks drifting above the cast, the same motif the rest of the site uses. */
const SPARKS = [
  { cx: 34, cy: 62, r: 4.0, dur: 7 },
  { cx: 112, cy: 34, r: 2.6, dur: 9 },
  { cx: 204, cy: 42, r: 3.2, dur: 8 },
  { cx: 276, cy: 92, r: 2.4, dur: 6.5 },
  { cx: 302, cy: 34, r: 3.6, dur: 10 },
];

export default function AuthCast({
  mood = "idle",
  /**
   * Increment to make the whole group dip once.
   *
   * A boolean cannot express "it happened again", and the checkbox can be
   * pressed twice in a row — so this is a counter, and the effect below fires
   * on every change rather than only on the way to `true`.
   */
  nudge = 0,
}: {
  mood?: CastMood;
  nudge?: number;
}) {
  const still = useReducedMotion();
  /*
    The dip, and where it had to end up.

    Two attempts died on the same wall. `useAnimationControls().start()` on a
    wrapping <g> did nothing — the effect fired with the right nudge and the
    element kept `transform: none` — and so did a plain `animate` object on
    that same wrapper. Measured both ways: peak offset 0.00px while the four
    characters inside it were visibly bobbing.

    So the dip lives on the characters themselves, which is the one place
    movement here is known to work. It replaces the bob for half a second and
    the bob picks up again after, which is also what a flinch actually looks
    like.
  */
  const [bouncing, setBouncing] = useState(false);

  const hiding = mood === "hiding";
  const watching = mood === "watching";
  const cheering = mood === "cheering";

  // The form is to their right, so that is where they look. One fixed offset,
  // not a position derived from how much has been typed.
  const look = still || hiding ? 0 : watching ? 7 : 0;

  useEffect(() => {
    if (!nudge || still) return;
    setBouncing(true);
    const id = window.setTimeout(() => setBouncing(false), 560);
    return () => window.clearTimeout(id);
  }, [nudge, still]);

  return (
    <svg
      aria-hidden
      viewBox="0 0 320 280"
      // Fills the panel in both directions and letterboxes itself; the
      // wrapper is what decides how much room that is.
      className="pointer-events-none h-full w-full select-none"
    >
      <defs>
        {/*
          Two stops each, lighter at the top-left. That single gradient is what
          reads as a rounded solid rather than a flat sticker; a real 3D
          transform would cost a compositing layer on a page that has to paint
          instantly.
        */}
        <linearGradient id="cast-saffron" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ff8a5c" />
          <stop offset="100%" stopColor="#cf3a0b" />
        </linearGradient>
        <linearGradient id="cast-indigo" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#5566c4" />
          <stop offset="100%" stopColor="#2f3f8f" />
        </linearGradient>
        <linearGradient id="cast-ink" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#6b7080" />
          <stop offset="100%" stopColor="#2c303c" />
        </linearGradient>
        <linearGradient id="cast-marigold" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#f0b64a" />
          <stop offset="100%" stopColor="#9a6206" />
        </linearGradient>

        {/* The ground the shadows fall on: no line, just a darkening. */}
        <radialGradient id="cast-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* A warm pool behind the group so it sits in the panel, not on it. */}
        <radialGradient id="cast-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ff8a5c" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff8a5c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Brighter while they are cheering: the pool is the applause. */}
      <motion.ellipse
        cx="160"
        cy="176"
        rx="168"
        ry="124"
        fill="url(#cast-glow)"
        animate={{ opacity: cheering ? 1.8 : 1 }}
        transition={{ duration: 0.4 }}
      />

      <g className="text-saffron-glow">
        {SPARKS.map((s) => (
          <motion.circle
            key={`${s.cx}-${s.cy}`}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="currentColor"
            // Resting opacity first, so a stalled animation still shows a dot.
            opacity={0.3}
            animate={still ? undefined : { opacity: [0.3, 0.75, 0.3], y: [0, -9, 0] }}
            transition={
              still
                ? undefined
                : { duration: cheering ? s.dur / 3 : s.dur, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}
      </g>

      <g>
        {CAST.map((c) => {
          const half = c.w / 2;
          const top = c.y - c.h;
          // Cheering is the same bob, higher and three times as quick.
          const bob = cheering ? c.bob * 1.9 : c.bob;
          const dur = cheering ? c.dur / 3.2 : c.dur;

          return (
            <motion.g
              key={c.id}
              animate={
                still ? undefined : { y: bouncing ? [0, -24, 0] : [0, -bob, 0], x: [0, c.sway, 0] }
              }
              transition={
                still
                  ? undefined
                  : {
                      y: bouncing
                        ? { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
                        : { duration: dur, delay: c.delay, repeat: Infinity, ease: "easeInOut" },
                      // Its own period, and a longer one, so the drift and the
                      // bob never come back into step.
                      x: {
                        duration: cheering ? c.swayDur / 2 : c.swayDur,
                        delay: c.delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }
              }
            >
              {/*
                The shadow shrinks as the character rises. It is the only cue
                that says the movement is a hop and not a slide, and it is
                cheaper than any amount of shading on the body itself.
              */}
              <motion.ellipse
                cx={c.x}
                cy={c.y + 10}
                rx={half * 0.92}
                ry={9}
                fill="url(#cast-pool)"
                animate={still ? undefined : { scaleX: [1, 0.76, 1], opacity: [1, 0.55, 1] }}
                transition={
                  still
                    ? undefined
                    : bouncing
                      ? { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
                      : { duration: dur, delay: c.delay, repeat: Infinity, ease: "easeInOut" }
                }
                style={{ transformOrigin: `${c.x}px ${c.y + 10}px` }}
              />

              {c.shape === "dome" ? (
                // A half-round: flat on the ground, fully rounded over the top.
                <path
                  d={`M ${c.x - half} ${c.y}
                      A ${half} ${c.h} 0 0 1 ${c.x + half} ${c.y} Z`}
                  fill={c.fill}
                />
              ) : (
                <rect x={c.x - half} y={top} width={c.w} height={c.h} rx={half} fill={c.fill} />
              )}

              {/*
                Eyes. Four things can be true of them, and only one at a time:
                shut because the password is masked, wide because the reveal is
                down, tracking the email, or idling and blinking on their own
                clock so the group never falls into step.
              */}
              <motion.g
                animate={{
                  x: look,
                  scaleX: watching ? 1.15 : 1,
                  scaleY: hiding ? 0.08 : watching ? 1.15 : still ? 1 : [1, 1, 0.12, 1],
                }}
                transition={{
                  // A slow turn of the head rather than a cut.
                  x: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
                  scaleX: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
                  scaleY:
                    hiding || watching || still
                      ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                      : {
                          duration: c.blink,
                          // The blink is the last 4% of the cycle; the rest is
                          // a held-open eye. Spreading it evenly would read as
                          // a slow, sleepy droop instead.
                          times: [0, 0.94, 0.97, 1],
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                }}
                style={{ transformOrigin: `${c.x}px ${c.y + c.eyes[0][1]}px` }}
              >
                {c.eyes.map(([dx, dy]) => (
                  <ellipse
                    key={`${dx}-${dy}`}
                    cx={c.x + dx}
                    cy={c.y + dy}
                    rx={6}
                    ry={7}
                    fill={c.eye}
                  />
                ))}
              </motion.g>

              {c.mouth && (
                <motion.path
                  /*
                     `?? idle` because not every character has a hiding or a
                     cheering mouth. Without it framer-motion animated `d`
                     toward undefined and wrote d="undefined" into the DOM,
                     which is the SVG parse error that has been in the console
                     on this page all along.
                  */
                  /*
                     `initial` is the fix, not the ?? below.

                     Without a starting value stated, the motion component
                     worked one out for itself before React had written the
                     `d` attribute, read undefined, and wrote the string
                     "undefined" into the DOM — where it stayed. So the
                     character rendered with no mouth at all and the console
                     carried an SVG parse error on every visit to this page.
                  */
                  initial={{ d: c.mouth.idle }}
                  animate={{
                    d:
                      (hiding ? c.mouth.hiding : cheering ? c.mouth.cheering : c.mouth.idle) ??
                      c.mouth.idle,
                  }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  d={c.mouth.idle}
                  transform={`translate(${c.x} ${c.y})`}
                  stroke={c.eye}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  fill="none"
                />
              )}

              {c.arm && (
                <motion.g
                  style={{ transformOrigin: `${c.arm.ox}px ${c.arm.oy}px` }}
                  animate={
                    still
                      ? undefined
                      : cheering
                        ? { rotate: [0, -38, -6, -34, 0] }
                        : { rotate: [0, -20, 4, -16, 0] }
                  }
                  transition={
                    still
                      ? undefined
                      : {
                          duration: cheering ? 0.9 : 2.2,
                          repeat: Infinity,
                          repeatDelay: cheering ? 0 : 3.4,
                          ease: "easeInOut",
                        }
                  }
                >
                  <path
                    d={c.arm.d}
                    stroke={c.arm.colour}
                    strokeWidth={11}
                    strokeLinecap="round"
                    fill="none"
                  />
                </motion.g>
              )}
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}
