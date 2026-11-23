/**
 * useTabPlan: adaptive tab order and default for a page (lane B2).
 *
 * - The first render is canonical, exactly what the server rendered, so guests and hydration see no change.
 * - The arrangement lands ONCE per page visit, when the evolution store and sign-in are ready, or never if
 *   the member has already picked a tab. After that the order does not move while they are on the page.
 * - Usage is local counts only (`swayam.tabs.v1`: page, tab, day, count, plus the order last shown).
 *   Nothing leaves the device, and "Off" in Your Swayam stops it being recorded.
 * - A deep link (`explicit`) always wins the default over any adaptive one.
 */
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTx } from "../../lib/i18n";
import type { TabPageId } from "../config/tabs";
import { planTabs, type TabPlan } from "../core/tabs/plan";
import {
  TAB_STORE_KEY,
  bumpUsage,
  emptyStore,
  parseTabStore,
  withShownOrder,
  type TabStore,
} from "../core/tabs/usage";
import { useEvolutionSnapshot } from "./hooks";

export interface TabPlanApi<T extends string> {
  order: T[];
  defaultId: T;
  /** True when the order differs from canonical: render <TabsHint /> next to the tabs. */
  arranged: boolean;
  /** Call when the member picks a tab. Records one local use. */
  onSelect: (id: T) => void;
}

const SEP = "\u0000";
const DAY_MS = 86_400_000;

function readStore(): TabStore {
  try {
    return parseTabStore(window.localStorage.getItem(TAB_STORE_KEY));
  } catch {
    return emptyStore();
  }
}

function writeStore(store: TabStore): void {
  try {
    window.localStorage.setItem(TAB_STORE_KEY, JSON.stringify(store));
  } catch {
    /* private mode or blocked storage: the tabs simply stay canonical */
  }
}

export function useTabPlan<T extends string>(
  pageId: TabPageId,
  canonical: readonly T[],
  opts: { explicit?: T | null } = {},
): TabPlanApi<T> {
  const snap = useEvolutionSnapshot();
  const { user, ready } = useAuth();
  const key = canonical.join(SEP);
  const explicit = opts.explicit ?? null;
  const stableNav = user?.role === "recruiter" || user?.role === "institute";
  const { hydrated, prefs, ui } = snap;

  const [settled, setSettled] = useState<TabPlan | null>(null);
  const frozen = useRef(false);

  const base = planTabs({
    pageId,
    canonical,
    state: "UNIVERSAL",
    tier: 0,
    mode: "BALANCED",
    usage: {},
    stableNav: false,
    explicit,
  });

  useEffect(() => {
    if (frozen.current || !hydrated || !ready) return;
    frozen.current = true;
    const ids = key.split(SEP);
    const store = readStore();
    const plan = planTabs({
      pageId,
      canonical: ids,
      state: ui.state,
      tier: ui.tier,
      mode: ui.mode,
      usage: store.u[pageId] ?? {},
      stableNav,
      adaptive: prefs.adaptive,
      locked: prefs.locked || ui.locked,
      explicit,
      previous: store.o[pageId],
      today: Math.floor(Date.now() / DAY_MS),
    });
    if (plan.order.join(SEP) !== (store.o[pageId] ?? []).join(SEP)) {
      writeStore(withShownOrder(store, pageId, plan.order));
    }
    if (plan.order.join(SEP) !== key || plan.defaultId !== base.defaultId) setSettled(plan);
  }, [hydrated, ready, key, pageId, explicit, stableNav, prefs, ui, base.defaultId]);

  const onSelect = useCallback(
    (id: T) => {
      frozen.current = true; // never rearrange under a hand that is already using the tabs
      if (prefs.adaptive === "off" || !key.split(SEP).includes(id)) return;
      writeStore(bumpUsage(readStore(), pageId, id, Math.floor(Date.now() / DAY_MS)));
    },
    [pageId, key, prefs.adaptive],
  );

  const shown =
    settled &&
    settled.order.length === base.order.length &&
    settled.order.every((id) => base.order.includes(id))
      ? settled
      : base;
  return {
    order: shown.order as T[],
    defaultId: (explicit ?? shown.defaultId) as T,
    arranged: shown.order.join(SEP) !== key,
    onSelect,
  };
}

/**
 * Arrow, Home and End keys for a row of role="tab" buttons laid out in DOM order.
 * Pair it with tabIndex={selected ? 0 : -1} on each tab (roving focus).
 */
export function tabKeyNav<T extends string>(
  e: KeyboardEvent<HTMLElement>,
  order: readonly T[],
  select: (id: T) => void,
): void {
  const tabs = Array.from(
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
  );
  const i = tabs.indexOf(e.currentTarget);
  const n = order.length;
  if (i < 0 || n === 0) return;
  let next: number;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = (i + 1) % n;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = (i - 1 + n) % n;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = n - 1;
      break;
    default:
      return;
  }
  e.preventDefault();
  select(order[next]!);
  tabs[next]?.focus();
}

/** "Tabs arranged for you", shown only when the order differs from canonical. */
export function TabsHint({ className = "" }: { className?: string }): ReactElement {
  const tx = useTx();
  return createElement(
    "p",
    { className: `font-body text-[12px] text-ink-mute ${className}`.trim() },
    tx("Tabs arranged for you."),
    " ",
    createElement(
      Link,
      {
        to: "/settings",
        hash: "your-swayam",
        className: "underline decoration-dotted underline-offset-4 hover:text-ink",
      },
      tx("Change in Your Swayam settings"),
    ),
  );
}
