/**
 * React selector hooks (plan §4.1). CONTRACT: names and return types of the original hooks are frozen.
 * All are SSR-safe: the server snapshot is UNIVERSAL and `hydrated: false`. useNavPlan and useHomePlan are
 * memoised by the compiled plan, which keeps its identity while its renderKey is unchanged, so a consumer
 * re-renders only on a committed structural change.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getRuntime, onRuntimeSwap } from "../state/commands";
import type { Bus } from "../state/bus";
import { noticeBus, whyBus, type EvolutionNoticeModel, type WhyPanelState } from "../state/notice";
import { syncStatusBus, type SyncStatus } from "../sync/supabase-sync";
import type { PreviewPlan } from "../state/types";
import type {
  AiStatus,
  EvolutionHistory,
  EvolutionPrefs,
  EvolutionSnapshot,
  EvolutionStatus,
  UIState,
} from "../types";

export type NavPlan = UIState["navigation"] &
  Pick<UIState, "state" | "tier" | "navMode" | "renderKey">;
export type HomePlan = Pick<
  UIState,
  | "hero"
  | "priorityActions"
  | "sections"
  | "display"
  | "density"
  | "movedUp"
  | "renderKey"
  | "state"
  | "tier"
  | "layout"
  | "locked"
>;

function useRuntimeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => onRuntimeSwap(() => setV((n) => n + 1)), []);
  return v;
}

export function useEvolutionSnapshot(): EvolutionSnapshot {
  useRuntimeVersion();
  const rt = getRuntime();
  return useSyncExternalStore(rt.subscribe, rt.getSnapshot, rt.getServerSnapshot);
}

export const useUiState = (): UIState => useEvolutionSnapshot().ui;

/**
 * The transient plan override (Time-Scrub, Try-On), or null. In memory only; the live snapshot is untouched.
 * The server and the hydration pass always see null.
 */
export function usePreviewPlan(): PreviewPlan | null {
  useRuntimeVersion();
  const rt = getRuntime();
  return useSyncExternalStore(rt.subscribePreview, rt.getPreview, () => null);
}

/** 0 when nothing is previewed; a new value for every preview or moved scrub stop. For ghost trails. */
export const usePreviewId = (): number => usePreviewPlan()?.id ?? 0;

/** The plan Home and navigation render: the preview while one is set, else the live plan. */
export const shownUi = (live: UIState, preview: PreviewPlan | null): UIState =>
  preview ? preview.ui : live;

export const navPlanOf = (ui: UIState): NavPlan => ({
  ...ui.navigation,
  state: ui.state,
  tier: ui.tier,
  navMode: ui.navMode,
  renderKey: ui.renderKey,
});

export const homePlanOf = (ui: UIState): HomePlan => ({
  hero: ui.hero,
  priorityActions: ui.priorityActions,
  sections: ui.sections,
  display: ui.display,
  density: ui.density,
  movedUp: ui.movedUp,
  renderKey: ui.renderKey,
  state: ui.state,
  tier: ui.tier,
  layout: ui.layout,
  locked: ui.locked,
});

function useShownUi(): UIState {
  const ui = useUiState();
  const preview = usePreviewPlan();
  return shownUi(ui, preview);
}

export function useNavPlan(): NavPlan {
  const ui = useShownUi();
  return useMemo(() => navPlanOf(ui), [ui]);
}

export function useHomePlan(): HomePlan {
  const ui = useShownUi();
  return useMemo(() => homePlanOf(ui), [ui]);
}

export const useEvolutionStatus = (): EvolutionStatus => useEvolutionSnapshot().status;
export const useEvolutionHistory = (): EvolutionHistory => useEvolutionSnapshot().history;
export const useAiStatus = (): AiStatus => useEvolutionSnapshot().ai;
export const useEvolutionPrefs = (): EvolutionPrefs => useEvolutionSnapshot().prefs;
/** False on the server and until the client store hydrates (D3 gate). */
export const useEvolutionHydrated = (): boolean => useEvolutionSnapshot().hydrated;

// ─── UI-only buses (notice, WhyPanel, sync) ────────────────────────────────────────────────────────────

function useBus<T>(bus: Bus<T>): T {
  return useSyncExternalStore(bus.subscribe, bus.get, bus.get);
}

/** The current "Swayam moved … up. Undo · Why?" announcement, or null. */
export const useEvolutionNotice = (): EvolutionNoticeModel | null => useBus(noticeBus);
export const useWhyPanelState = (): WhyPanelState => useBus(whyBus);
/** Whether an account copy exists on the server (Settings shows "Delete synced copy" only then). */
export const useSyncStatus = (): SyncStatus => useBus(syncStatusBus);

// ─── frame budget (html[data-fx], stamped by the shell) ────────────────────────────────────────────────

const fxLightened = (): boolean => {
  try {
    const fx = document.documentElement.dataset["fx"];
    return fx === "lite" || fx === "static";
  } catch {
    return false;
  }
};

function subscribeFx(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("swayam:fx", cb);
  let mo: MutationObserver | null = null;
  try {
    mo = new MutationObserver(cb);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fx"] });
  } catch {
    /* the event alone is enough */
  }
  return () => {
    window.removeEventListener("swayam:fx", cb);
    mo?.disconnect();
  };
}

/** True when Swayam lightened itself for this device (html[data-fx] is lite or static). SSR: false. */
export const useFxLightened = (): boolean =>
  useSyncExternalStore(subscribeFx, fxLightened, () => false);
