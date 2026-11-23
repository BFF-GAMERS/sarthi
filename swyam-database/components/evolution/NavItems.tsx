/**
 * Renders a list of navigation destinations from the registry.
 * CONTRACT: default export + props below. Every nav surface uses it; the Lab's
 * StructureDiagram reuses it with surface="diagram" (plain text: no links, no
 * tracking, no router). Every clickable surface fires
 * track(EV.NAVIGATION_ITEM_CLICKED, { item, surface, position, state }).
 */
import { Link } from "@tanstack/react-router";
import { LayoutGroup, motion } from "framer-motion";
import {
  BadgeCheck,
  Backpack,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Compass,
  Dumbbell,
  FileText,
  FlaskConical,
  Gift,
  GraduationCap,
  Hammer,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Library,
  LibraryBig,
  Mail,
  MessageCircle,
  MessagesSquare,
  Repeat,
  Rocket,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EV } from "@/evolution/config/ids";
import { NAV_REGISTRY, hrefFor } from "@/evolution/config/navigation";
import { useUiState } from "@/evolution/react/hooks";
import { track } from "@/evolution/runtime/tracker/track";
import type { NavItemId, NavSurface } from "@/evolution/types";
import { useTheme } from "@/context/PreferencesContext";
import { NavActiveIndicator } from "@/components/motion/NavActiveIndicator";
import { useReducedMotionPref } from "@/components/motion/hooks";
import { usePressProps } from "@/components/motion/PressScale";
import { SPRING } from "@/components/motion/tokens";
import { useTx } from "@/lib/i18n";
import { parseHref } from "./nav-model";
import { useActiveNavItem, useInstantMotion, useNavLabel } from "./use-nav";

export interface NavItemsProps {
  items: readonly NavItemId[];
  surface: NavSurface | "diagram";
  signedIn: boolean;
  /** Items to highlight (e.g. changed vs UNIVERSAL in Before/After). */
  highlight?: readonly NavItemId[];
  className?: string;
}

/** lucide icons by the registry's icon name. */
const ICONS: Record<string, LucideIcon> = {
  Backpack,
  BadgeCheck,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Compass,
  Dumbbell,
  FileText,
  FlaskConical,
  Gift,
  GraduationCap,
  Hammer,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Library,
  LibraryBig,
  Mail,
  MessageCircle,
  MessagesSquare,
  Repeat,
  Rocket,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  UserRound,
  Users,
};

export function NavIcon({
  id,
  size = 18,
  strokeWidth,
  className,
}: {
  id: NavItemId;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = ICONS[NAV_REGISTRY[id].icon] ?? Compass;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden className={className} />;
}

export interface NavLinkItemProps {
  id: NavItemId;
  surface: NavSurface;
  signedIn: boolean;
  /** Index in its list, sent with the click. */
  position: number;
  active: boolean;
}

/** Linked destinations that give under a finger. `motion.create` keeps the router's typed `Link`. */
const MotionLink = motion.create(Link);

/** Marker corner radius in px, per register. Inline because framer-motion counter-scales it mid-flight. */
function useMarkerRadius(control = false): number {
  const { mode } = useTheme();
  if (mode === "genz") return control ? 10 : 999;
  return 6;
}

/** The pressed state of a bottom-bar slot: only the icon holder gives, never the 60px target. */
const HOLDER_PRESS = { rest: {}, pressed: { scale: 0.86 } } as const;
const HOLDER_PRESS_REDUCED = { rest: {}, pressed: { opacity: 0.6 } } as const;

/** One tracked link, styled for its surface. The caller owns the surrounding <li>. */
export function NavLinkItem({ id, surface, signedIn, position, active }: NavLinkItemProps) {
  const { state } = useUiState();
  const labelOf = useNavLabel();
  const tx = useTx();
  const reduced = useReducedMotionPref();
  const radius = useMarkerRadius();
  const controlRadius = useMarkerRadius(true);
  // Small controls give more than big surfaces, the way a key does against a pad.
  const press = usePressProps({
    scale: surface === "top" ? 0.95 : surface === "rail" ? 0.975 : 0.985,
    disabled: surface === "bottom" || surface === "footer",
  });
  const d = NAV_REGISTRY[id];
  const href = parseHref(hrefFor(id, signedIn));
  const label = labelOf(id);
  const purpose = tx(d.purpose);
  const current = active ? ("page" as const) : undefined;
  const onClick = () => track(EV.NAVIGATION_ITEM_CLICKED, { item: id, surface, position, state });
  const lp = {
    to: href.to,
    search: href.search as never,
    hash: href.hash,
    onClick,
    "aria-current": current,
  };

  switch (surface) {
    case "top":
      return (
        <MotionLink {...lp} {...press} className="nav-link" data-active={active}>
          <span data-active={active} className="relative z-10">
            {label}
          </span>
          {active && (
            <NavActiveIndicator
              layoutId="nav-marker"
              className="absolute inset-0 bg-saffron-50"
              radius={radius}
            />
          )}
        </MotionLink>
      );
    case "bottom":
      return (
        <MotionLink
          {...lp}
          whileTap="pressed"
          className={`group flex min-h-[3.75rem] flex-col items-center justify-start gap-0.5 px-0.5 pb-1 pt-1.5 transition-colors ${
            active ? "text-saffron-600" : "text-ink-mute"
          }`}
        >
          <motion.span
            aria-hidden
            variants={reduced ? HOLDER_PRESS_REDUCED : HOLDER_PRESS}
            transition={SPRING.micro}
            className="relative isolate grid h-7 w-12 place-items-center"
          >
            {active && (
              <NavActiveIndicator
                layoutId="bn-pill"
                className="absolute inset-0 -z-10 bg-saffron-50"
                radius={radius}
              />
            )}
            <motion.span
              animate={{ scale: active && !reduced ? 1.08 : 1 }}
              transition={SPRING.micro}
              className="grid place-items-center"
            >
              <NavIcon id={id} size={19} strokeWidth={active ? 2.2 : 1.8} />
            </motion.span>
          </motion.span>
          {/* Wraps to two lines instead of cutting "Applications" to "Applicat…". */}
          <span className="line-clamp-2 w-full text-balance break-words text-center font-body text-[10.5px] font-semibold leading-[1.15] tracking-[-0.005em]">
            {label}
          </span>
        </MotionLink>
      );
    case "rail":
      return (
        <MotionLink
          {...lp}
          {...press}
          className={`group relative isolate flex items-start gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 transition-colors ${
            active ? "text-ink" : "text-ink-soft hover:bg-paper-light/70 hover:text-ink"
          }`}
        >
          {active && (
            <NavActiveIndicator
              layoutId="rail-marker"
              className="absolute inset-0 -z-10 bg-paper-light before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-saffron-500"
              radius={controlRadius}
            />
          )}
          <NavIcon
            id={id}
            size={16}
            strokeWidth={active ? 2.2 : 1.8}
            className={`mt-0.5 shrink-0 ${active ? "text-saffron-500" : "text-ink-mute"}`}
          />
          <span className="min-w-0">
            <span className="block font-body text-[13.5px] font-semibold leading-snug">
              {label}
            </span>
            {/* Only where you are: "what is this section for" is a question asked once. */}
            {active && (
              <span className="mt-0.5 block font-body text-[11.5px] leading-snug text-ink-mute">
                {purpose}
              </span>
            )}
          </span>
        </MotionLink>
      );
    case "explore":
      return (
        <MotionLink
          {...lp}
          {...press}
          className="evo-nav-card group flex items-start gap-3 rounded-2xl border border-ink-line bg-paper-light p-4 transition-[background-color,border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-saffron-200 hover:bg-saffron-50 hover:shadow-[var(--shadow-lift)]"
        >
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-dim text-saffron-500"
          >
            <NavIcon id={id} size={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-body text-[15px] font-semibold leading-tight text-ink">
              {label}
            </span>
            <span className="mt-1 block font-body text-[13px] leading-snug text-ink-mute">
              {purpose}
            </span>
            {d.requiresAuth && !signedIn && (
              <span className="mt-1.5 block font-body text-[11.5px] font-semibold text-ink-soft">
                {tx("Sign in to open")}
              </span>
            )}
          </span>
        </MotionLink>
      );
    case "footer":
      return (
        <Link
          {...lp}
          className="font-body text-[15px] text-paper-light/80 transition-colors hover:text-paper-light"
        >
          {label}
        </Link>
      );
    default:
      // drawer, more, shortcut, sarthi: a label with its purpose underneath.
      return (
        <MotionLink
          {...lp}
          {...press}
          className={`group block rounded-xl px-3 py-2.5 transition-colors hover:bg-paper-dim ${
            active ? "bg-saffron-50" : ""
          }`}
        >
          <span className="evo-nav-label block font-body text-[14px] font-semibold leading-tight text-ink">
            {label}
          </span>
          <span className="evo-nav-purpose mt-0.5 block font-body text-[12px] leading-snug text-ink-mute">
            {purpose}
          </span>
        </MotionLink>
      );
  }
}

/** Plain text: no links, no tracking, no router. For the Lab's before/after diagrams. */
function DiagramList({
  items,
  highlight,
  className,
}: Pick<NavItemsProps, "items" | "highlight" | "className">) {
  return (
    <ul className={className} data-surface="diagram">
      {items.map((id) => (
        <li
          key={id}
          data-nav-item={id}
          data-highlight={highlight?.includes(id) ? "true" : undefined}
        >
          <span>{NAV_REGISTRY[id].label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function NavItems(props: NavItemsProps) {
  if (props.surface === "diagram") {
    return (
      <DiagramList items={props.items} highlight={props.highlight} className={props.className} />
    );
  }
  return <LinkList {...props} surface={props.surface} />;
}

function LinkList({
  items,
  surface,
  signedIn,
  highlight,
  className,
}: NavItemsProps & { surface: NavSurface }) {
  const activeId = useActiveNavItem(items);
  const instant = useInstantMotion();
  // The top and bottom bars re-order when the plan changes; an item that stays
  // glides to its new slot. One group per surface keeps their markers apart.
  const glides = surface === "top" || surface === "bottom";
  const list = (
    <ul className={className} data-surface={surface}>
      {items.map((id, i) => {
        const marks = {
          "data-nav-item": id,
          "data-highlight": highlight?.includes(id) ? "true" : undefined,
        };
        const link = (
          <NavLinkItem
            id={id}
            surface={surface}
            signedIn={signedIn}
            position={i}
            active={activeId === id}
          />
        );
        if (glides) {
          return (
            <motion.li
              key={id}
              layout={instant ? false : "position"}
              className={surface === "bottom" ? "min-w-0 flex-1" : undefined}
              {...marks}
            >
              {link}
            </motion.li>
          );
        }
        return (
          <li key={id} {...marks}>
            {link}
          </li>
        );
      })}
    </ul>
  );
  return glides ? <LayoutGroup id={`evo-nav-${surface}-list`}>{list}</LayoutGroup> : list;
}
