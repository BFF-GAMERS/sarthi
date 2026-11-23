import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, LayoutGroup, PresenceContext, useIsPresent } from "framer-motion";
import { usePreviewId } from "../../evolution/react/hooks";
import { FocusKeeper } from "./FocusKeeper";
import {
  diffStageKeys,
  pickGhosts,
  staggerDelays,
  type GhostPick,
  type StageDiff,
} from "./evolution-diff";
import { useMotionPrefs } from "./hooks";
import { motionTag } from "./tags";
import { DISTANCE, DURATION, EASE_OUT_SOFT, INSTANT, SPRING, STAGGER, fade } from "./tokens";

/** What a rendered item is told about its place in the current evolution. */
export interface StageItemContext {
  /** Position in the list now, from zero. */
  index: number;
  /**
   * True for about two seconds after this item was promoted. Use it to show a
   * "Moved up for you" chip. The highlight itself is drawn by the stage.
   */
  promoted: boolean;
  /** Reduced motion is on: the stage is re-ordering without travelling. */
  reduced: boolean;
}

export type StageContainerTag = "div" | "ul" | "ol" | "nav" | "section";
export type StageItemTag = "div" | "li" | "section" | "article";

export interface EvolutionStageProps<T> extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /**
   * Names this stage's layout group. Must be unique per surface ("evo-home",
   * "evo-nav-top", "evo-nav-bottom"); it also namespaces any `layoutId`
   * rendered inside, so two navs can each have an active indicator.
   */
  groupId: string;
  /** The items in their current order. Re-order or change the set to evolve. */
  items: readonly T[];
  /** A stable identity per item. This is what keeps component state alive. */
  getKey: (item: T) => string;
  /** Renders one item's content. The stage supplies the animated wrapper. */
  renderItem: (item: T, ctx: StageItemContext) => ReactNode;
  /** Container element. Default `div`; use `ul` with `itemAs="li"` for nav. */
  as?: StageContainerTag;
  /** Wrapper element around each item. Default `div`. */
  itemAs?: StageItemTag;
  /** Classes for each item wrapper, fixed or per item. */
  itemClassName?: string | ((item: T, ctx: StageItemContext) => string | undefined);
  /** Extra `data-*` attributes per item wrapper, e.g. `{ "data-section": id }`. */
  getItemAttrs?: (item: T) => Record<`data-${string}`, string | undefined>;
  /**
   * What the layout animation may change. `position` (default) only moves the
   * item, so text never stretches; `both` also animates size changes.
   */
  layoutMode?: "position" | "size" | "both";
  /** Draw the brief "interface is thinking" highlight on promoted items. */
  highlight?: boolean;
  /** CSS colour of the highlight. Defaults to the theme's saffron. */
  highlightColor?: string;
  /** CSS border-radius of the highlight ring. Match your item's radius. */
  highlightRadius?: string;
  /** The most items highlighted per evolution. Default 2. */
  maxHighlighted?: number;
  /**
   * Overrides which items are highlighted, e.g. with the engine's own
   * "moved up" list. Applies to the next change only.
   */
  promotedKeys?: readonly string[];
  /** Called once per evolution with what changed. Never blocks the render. */
  onEvolve?: (diff: StageDiff) => void;
}

interface Wave {
  id: number;
  promoted: ReadonlySet<string>;
  delays: ReadonlyMap<string, number>;
  diff: StageDiff;
}

/** One faint outline left at an old slot while a preview re-orders the stage (Time-Scrub, Try-On). */
interface GhostBox {
  key: string;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Negative = moved up among its peers. */
  delta: number;
  /** Where it went, measured after the commit; null = not measured or it did not move on screen. */
  dir: "up" | "down" | "left" | "right" | null;
}

interface GhostSet {
  id: number;
  boxes: GhostBox[];
  measured: boolean;
}

const MAX_GHOSTS = 3;
const GHOST_MS = 1500;

/** Layout positions (not transformed ones) of the picked items, read from the DOM that is still the old layout. */
function readSlots(container: HTMLElement | null, picks: readonly GhostPick[]): GhostBox[] {
  if (!container) return [];
  const byKey = new Map<string, HTMLElement>();
  for (const el of Array.from(container.children)) {
    const k = (el as HTMLElement).dataset?.["evoItem"];
    if (k) byKey.set(k, el as HTMLElement);
  }
  const out: GhostBox[] = [];
  for (const pick of picks) {
    const el = byKey.get(pick.key);
    if (!el || el.offsetHeight < 8 || el.offsetWidth < 8) continue;
    out.push({
      key: pick.key,
      top: el.offsetTop,
      left: el.offsetLeft,
      width: el.offsetWidth,
      height: el.offsetHeight,
      delta: pick.delta,
      dir: null,
    });
  }
  return out;
}

const DEFAULT_COLOR = "var(--color-saffron-500, #f05a22)";
const DEFAULT_RADIUS = "var(--radius, 14px)";
/** The wave outlives the highlight a little, so a stagger delay never lapses early. */
const WAVE_MS = DURATION.highlight * 1000 + 250;

/**
 * A list of sections or nav items that re-orders itself like it is thinking.
 *
 * Hand it the items in their new order and it does the rest:
 *
 *   - Items that moved glide to their new place on the `major` spring. The
 *     promoted item leaves first and its neighbours follow a few frames
 *     later, so the list reads as making room for it. Nothing flies; only
 *     position changes, and only `transform` and `opacity` are animated.
 *   - Items that arrive fade in and rise 12px. Items that leave fade out
 *     without holding space, so the others close the gap straight away.
 *   - The promoted item (at most two) gets a hairline that draws across its
 *     top edge and a soft ring that fades in and out. Under reduced motion
 *     the hairline is dropped and only the ring fades.
 *
 * What it guarantees:
 *
 *   - State survives. Each item is keyed, so a reorder moves the existing
 *     element instead of remounting it: form fields, scroll positions inside
 *     the item and query data all stay. Keyboard focus is restored if the
 *     browser drops it during the move (see `FocusKeeper`).
 *   - Input is never blocked. The highlight and a leaving item have
 *     `pointer-events: none`, nothing waits on an animation to finish, and a
 *     second change mid-flight simply retargets the springs.
 *   - Reduced motion and a hidden tab still evolve the structure, instantly.
 *   - Server rendering is plain: the first render has no entrance animation
 *     and no hidden content.
 *
 * It renders the first set of items without animating. Feed it the persisted
 * order on the first render so there is no flash of the old layout.
 *
 * @example
 * <EvolutionStage
 *   groupId="evo-home"
 *   items={uiState.sections}
 *   getKey={(s) => s.id}
 *   itemAs="section"
 *   getItemAttrs={(s) => ({ "data-section": s.id })}
 *   renderItem={(s, { promoted }) => <Section id={s.id} moved={promoted} />}
 * />
 */
export function EvolutionStage<T>({
  groupId,
  items,
  getKey,
  renderItem,
  as = "div",
  itemAs = "div",
  itemClassName,
  getItemAttrs,
  layoutMode = "position",
  highlight = true,
  highlightColor = DEFAULT_COLOR,
  highlightRadius = DEFAULT_RADIUS,
  maxHighlighted = 2,
  promotedKeys,
  onEvolve,
  style,
  ...containerProps
}: EvolutionStageProps<T>) {
  const { reduced, frozen } = useMotionPrefs();
  const containerRef = useRef<HTMLDivElement>(null);

  const keys = items.map(getKey);
  const signature = keys.join("\u001f");

  /*
   * Detect a change while rendering, not in an effect. Setting state during
   * render is React's documented way to derive state from a changed input: it
   * re-renders straight away, before anything is committed, so the stagger
   * delays and the promoted set are already in place for the very commit that
   * moves the items. An effect would run a frame late and the layout animation
   * would start without them.
   */
  const [seen, setSeen] = useState({ signature, keys });
  const [wave, setWave] = useState<Wave | null>(null);
  const previewId = usePreviewId();
  const [seenPreview, setSeenPreview] = useState(previewId);
  const [ghosts, setGhosts] = useState<GhostSet | null>(null);
  if (seenPreview !== previewId) setSeenPreview(previewId);
  if (seen.signature !== signature) {
    setSeen({ signature, keys });
    // A preview started, moved or ended together with this re-order: leave ghosts at the old slots. The DOM is
    // still the old layout during this render, which is the only time the old slots can be read.
    if (previewId !== seenPreview && typeof window !== "undefined") {
      const boxes = readSlots(containerRef.current, pickGhosts(seen.keys, keys, MAX_GHOSTS));
      setGhosts(boxes.length > 0 ? { id: (ghosts?.id ?? 0) + 1, boxes, measured: false } : null);
    }
    const diff = diffStageKeys(seen.keys, keys, maxHighlighted);
    if (diff.changed) {
      const promoted = new Set(promotedKeys ?? diff.promoted);
      setWave({
        id: (wave?.id ?? 0) + 1,
        promoted,
        delays: staggerDelays(keys, promoted),
        diff,
      });
    }
  }

  const onEvolveRef = useRef(onEvolve);
  useEffect(() => {
    onEvolveRef.current = onEvolve;
  });

  useEffect(() => {
    if (!wave) return;
    onEvolveRef.current?.(wave.diff);
    const timer = window.setTimeout(() => setWave(null), WAVE_MS);
    return () => window.clearTimeout(timer);
  }, [wave]);

  // Where did each ghost's item go? Layout offsets are transform-free, so this is right even mid-FLIP.
  useLayoutEffect(() => {
    if (!ghosts || ghosts.measured) return;
    const byKey = new Map<string, HTMLElement>();
    for (const el of Array.from(containerRef.current?.children ?? [])) {
      const k = (el as HTMLElement).dataset?.["evoItem"];
      if (k) byKey.set(k, el as HTMLElement);
    }
    const boxes = ghosts.boxes.map((b): GhostBox => {
      const el = byKey.get(b.key);
      if (!el) return b;
      const dy = el.offsetTop - b.top;
      const dx = el.offsetLeft - b.left;
      const dir =
        Math.abs(dy) >= Math.abs(dx)
          ? dy > 2
            ? "down"
            : dy < -2
              ? "up"
              : null
          : dx > 2
            ? "right"
            : dx < -2
              ? "left"
              : null;
      return { ...b, dir };
    });
    setGhosts({ ...ghosts, boxes, measured: true });
  }, [ghosts]);

  const ghostId = ghosts?.id ?? 0;
  useEffect(() => {
    if (!ghostId) return;
    const timer = window.setTimeout(() => setGhosts(null), GHOST_MS + 100);
    return () => window.clearTimeout(timer);
  }, [ghostId]);

  const layout = reduced || frozen ? false : layoutMode === "both" ? true : layoutMode;
  const Container = as as "div";

  return (
    <LayoutGroup id={groupId}>
      <FocusKeeper signature={signature} containerRef={containerRef}>
        <Container
          {...containerProps}
          ref={containerRef}
          // `popLayout` takes leaving items out of flow and positions them
          // against this element, so it must be a positioned ancestor.
          style={{ position: "relative", ...style }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item, index) => {
              const key = getKey(item);
              const promoted = wave?.promoted.has(key) ?? false;
              const ctx: StageItemContext = { index, promoted, reduced };
              return (
                <StageItem
                  key={key}
                  tag={itemAs}
                  itemKey={key}
                  className={
                    typeof itemClassName === "function" ? itemClassName(item, ctx) : itemClassName
                  }
                  attrs={getItemAttrs?.(item)}
                  layout={layout}
                  reduced={reduced}
                  frozen={frozen}
                  delay={wave?.delays.get(key) ?? 0}
                  promoted={promoted}
                  glow={highlight && promoted}
                  glowId={wave?.id ?? 0}
                  color={highlightColor}
                  radius={highlightRadius}
                >
                  {renderItem(item, ctx)}
                </StageItem>
              );
            })}
          </AnimatePresence>
          {ghosts && ghosts.measured ? (
            <GhostTrails
              key={ghosts.id}
              boxes={ghosts.boxes}
              as={as}
              color={highlightColor}
              radius={highlightRadius}
              reduced={reduced}
            />
          ) : null}
        </Container>
      </FocusKeeper>
    </LayoutGroup>
  );
}

interface StageItemProps {
  /** React 19 passes `ref` as a prop; `AnimatePresence` needs it to pop items out. */
  ref?: Ref<HTMLElement>;
  tag: StageItemTag;
  itemKey: string;
  className?: string;
  attrs?: Record<string, string | undefined>;
  layout: false | true | "position" | "size";
  reduced: boolean;
  frozen: boolean;
  delay: number;
  promoted: boolean;
  glow: boolean;
  glowId: number;
  color: string;
  radius: string;
  children: ReactNode;
}

/** One animated item: layout glide, enter, exit and the promotion glow. */
function StageItem({
  ref,
  tag,
  itemKey,
  className,
  attrs,
  layout,
  reduced,
  frozen,
  delay,
  promoted,
  glow,
  glowId,
  color,
  radius,
  children,
}: StageItemProps) {
  const isPresent = useIsPresent();
  const Tag = motionTag(tag);
  const rise = reduced ? 0 : DISTANCE.rise;
  const showGlow = glow && !frozen && isPresent;

  return (
    <Tag
      {...attrs}
      ref={ref as Ref<HTMLDivElement>}
      className={className}
      data-evo-item={itemKey}
      data-evo-promoted={promoted ? "true" : undefined}
      layout={layout}
      // Reduced motion is a stepped snapshot: items appear and leave in one frame, nothing is left running.
      initial={frozen || reduced ? false : { opacity: 0, y: rise }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          opacity: fade(DURATION.base, STAGGER.enter),
          y: { ...SPRING.standard, delay: STAGGER.enter },
        },
      }}
      exit={{ opacity: 0, transition: frozen || reduced ? INSTANT : fade(DURATION.fast) }}
      transition={{ layout: { ...SPRING.major, delay } }}
      style={showGlow ? { position: "relative" } : undefined}
      // A leaving item is still in the DOM for a moment: keep it out of the
      // tab order and the accessibility tree so it can never take a click.
      inert={!isPresent}
    >
      {/*
        Reset the presence context for everything inside the item. The stage
        uses `AnimatePresence initial={false}` so the first set of items does
        not animate in, but that setting leaks to every motion component
        below an item that was there on the first render, silently turning
        off their own mount animations (a `RevealOnView` inside a Home section
        would never reveal). The item's own enter and exit use the context
        above this point and are unaffected.
      */}
      <PresenceContext.Provider value={null}>{children}</PresenceContext.Provider>
      {showGlow && <PromotionGlow key={glowId} color={color} radius={radius} reduced={reduced} />}
    </Tag>
  );
}

/**
 * The "interface is thinking" mark: a hairline drawing across the top edge
 * and a ring that fades in, holds, and fades out. Both are `opacity` and
 * `transform` only, both are `pointer-events: none`, and neither loops.
 *
 * It is driven by the Web Animations API rather than framer-motion, on
 * purpose. A re-order is the heaviest moment on the main thread (every moving
 * section is being re-measured and re-projected each frame), and an overlay
 * whose animation is `opacity` and `transform` only is run by the browser's
 * compositor with no JavaScript per frame, so the glow cannot stutter or add
 * to the load. The elements start at `opacity: 0`, so before the effect runs
 * (and in browsers without `Element.animate`) there is simply no glow.
 */
function PromotionGlow({
  color,
  radius,
  reduced,
}: {
  color: string;
  radius: string;
  reduced: boolean;
}) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Reduced motion: the ring is simply drawn (see its style) until the wave ends; nothing runs.
    if (reduced) return;
    const running: Animation[] = [];
    const ring = ringRef.current;
    const line = lineRef.current;
    const ease = `cubic-bezier(${EASE_OUT_SOFT.join(", ")})`;

    if (ring && typeof ring.animate === "function") {
      running.push(
        ring.animate(
          [
            { opacity: 0 },
            { opacity: 0.6, offset: 0.18 },
            { opacity: 0.6, offset: 0.6 },
            { opacity: 0 },
          ],
          {
            duration: DURATION.highlight * 1000,
            easing: "ease-in-out",
            fill: "both",
          },
        ),
      );
    }
    if (line && typeof line.animate === "function") {
      running.push(
        line.animate(
          [
            { opacity: 0, transform: "scaleX(0)" },
            { opacity: 1, transform: "scaleX(1)", offset: 0.35 },
            { opacity: 1, transform: "scaleX(1)", offset: 0.7 },
            { opacity: 0, transform: "scaleX(1)" },
          ],
          { duration: 1200, easing: ease, fill: "both" },
        ),
      );
    }
    return () => running.forEach((a) => a.cancel());
  }, [reduced]);

  return (
    <>
      <span
        ref={ringRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: reduced ? 0.6 : 0,
          borderRadius: radius,
          boxShadow: `0 0 0 1px ${color}, 0 14px 40px -18px ${color}`,
        }}
      />
      {!reduced && (
        <span
          ref={lineRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left"
          style={{
            opacity: 0,
            transform: "scaleX(0)",
            borderRadius: radius,
            background: `linear-gradient(90deg, transparent, ${color} 25%, ${color} 75%, transparent)`,
          }}
        />
      )}
    </>
  );
}

/**
 * Ghost trails: a faint dashed outline where a section used to be, and a short arrow at it pointing the way it
 * went. They are `aria-hidden`, `pointer-events: none` and out of flow, so nothing can be clicked, read or
 * pushed around by them. Normally the outline fades in and out with the Web Animations API (opacity only, on the
 * compositor); under reduced motion it is a still outline for a moment and then gone, with no animation running.
 */
function GhostTrails({
  boxes,
  as,
  color,
  radius,
  reduced,
}: {
  boxes: readonly GhostBox[];
  as: StageContainerTag;
  color: string;
  radius: string;
  reduced: boolean;
}) {
  const els = useRef<Array<HTMLElement | null>>([]);
  const Tag = (as === "ul" || as === "ol" ? "li" : "span") as "span";

  useEffect(() => {
    if (reduced) return;
    const running: Animation[] = [];
    for (const el of els.current) {
      if (!el || typeof el.animate !== "function") continue;
      running.push(
        el.animate(
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.16 },
            { opacity: 1, offset: 0.62 },
            { opacity: 0 },
          ],
          { duration: GHOST_MS, easing: "ease-in-out", fill: "both" },
        ),
      );
    }
    return () => running.forEach((a) => a.cancel());
  }, [reduced]);

  return (
    <>
      {boxes.map((b, i) => (
        <Tag
          key={b.key}
          ref={(el: HTMLElement | null) => {
            els.current[i] = el;
          }}
          aria-hidden="true"
          role="presentation"
          data-evo-ghost={b.key}
          style={{
            position: "absolute",
            top: b.top,
            left: b.left,
            width: b.width,
            height: b.height,
            pointerEvents: "none",
            listStyle: "none",
            boxSizing: "border-box",
            borderRadius: radius,
            border: `1.5px dashed color-mix(in srgb, ${color} 70%, transparent)`,
            background: `color-mix(in srgb, ${color} 6%, transparent)`,
            opacity: reduced ? 0.7 : 0,
          }}
        >
          {b.dir && b.height >= 44 ? (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                display: "grid",
                placeItems: "center",
                width: 30,
                height: 30,
                borderRadius: 999,
                border: `1px solid ${color}`,
                background: "var(--color-paper-light, #fff)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: `rotate(${b.dir === "up" ? 0 : b.dir === "right" ? 90 : b.dir === "down" ? 180 : 270}deg)`,
                }}
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
          ) : null}
        </Tag>
      ))}
    </>
  );
}
