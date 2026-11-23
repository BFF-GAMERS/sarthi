/**
 * compose(): a validated EvolutionDecision + tier + context → the UIState the
 * React UI renders. Pure and deterministic; everything comes from
 * EVOLUTION_CONFIG. Navigation, layout and actions are ALWAYS recomposed here,
 * never taken from the AI (plan §5.4).
 *
 * Staged reveal (plan §3.3):
 *   tier 0  UNIVERSAL everything
 *   tier 1  CTA + lede, 2 domain actions + 2 universal, first 2 hub sections lead; nav unchanged
 *   tier 2  domain-priority nav, all hub sections lead, 3 domain actions + 1 universal
 *   tier 3  mode overlay (density, pins, display), 4 domain actions, non-hub sections fold
 */
import { EVOLUTION_CONFIG as C, type ModeOverlay } from "../../config/evolution-config";
import { NAV_ITEM_IDS, DOMAIN_IDS } from "../../config/ids";
import { NAV_REGISTRY } from "../../config/navigation";
import { SECTION_META } from "../../config/sections";
import { PRIORITY_ACTIONS } from "../../config/actions";
import type {
  ComposeContext,
  EvolutionDecision,
  EvolutionState,
  NavGroup,
  NavItemId,
  NavMode,
  PriorityActionId,
  SectionId,
  ServiceId,
  Tier,
  UIDisplay,
  UISection,
  UIState,
} from "../../types";

const MAX_ACTIONS = 4;

/** Priority actions for a state at a tier: domain actions first, topped up with universal ones. */
export function actionsFor(state: EvolutionState, tier: Tier): PriorityActionId[] {
  const universal = C.priorityActions.UNIVERSAL as PriorityActionId[];
  if (state === "UNIVERSAL" || tier === 0) return universal.slice(0, MAX_ACTIONS);
  const own = (C.priorityActions[state] as PriorityActionId[]).slice(
    0,
    state === "EXPLORER" ? MAX_ACTIONS : C.tiers[tier].actions,
  );
  const domain = C.states[state].domain;
  const out = [...own];
  for (const id of universal) {
    if (out.length >= MAX_ACTIONS) break;
    if (out.includes(id)) continue;
    if (domain && PRIORITY_ACTIONS[id].domain === domain) continue;
    out.push(id);
  }
  return out.slice(0, MAX_ACTIONS);
}

function navList(mode: NavMode, signedIn: boolean): NavItemId[] {
  const list = [...(C.navigation[mode] as NavItemId[])];
  // Visitors have no inbox: MESSAGES becomes EVENTS (plan §3.4 registry).
  return signedIn ? list : list.map((id) => (id === "MESSAGES" ? "EVENTS" : id));
}

function overflowFor(top: NavItemId[]): NavGroup[] {
  const order: ServiceId[] = [...DOMAIN_IDS, "PLATFORM"];
  const groups: NavGroup[] = order.map((domain) => ({ domain, items: [] }));
  for (const id of NAV_ITEM_IDS) {
    if (top.includes(id)) continue;
    const d = NAV_REGISTRY[id].domain;
    if (d === "ACCOUNT") continue; // stays in the avatar menu
    groups[order.indexOf(d)].items.push(id);
  }
  return groups.filter((g) => g.items.length > 0);
}

function sectionOrder(
  state: EvolutionState,
  tier: Tier,
  overlay: ModeOverlay | null,
): { ids: SectionId[]; folded: Set<SectionId> } {
  const universal = C.layouts.UNIVERSAL as SectionId[];
  const layout = C.states[state].layout;
  const folded = new Set<SectionId>();
  let ids: SectionId[];

  if (tier === 0 || layout === "UNIVERSAL") {
    ids = universal.filter((id) => id !== "CLOSING");
  } else {
    const hub: SectionId[] = (C.layouts[layout] as SectionId[]).filter(
      (id) => id !== "MORE_FOR_YOU" && id !== "CLOSING",
    );
    const t = C.tiers[tier];
    const lead: SectionId[] = tier === 1 ? hub.slice(0, t.hubLead) : hub;
    const rest: SectionId[] = universal.filter((id) => id !== "CLOSING" && !lead.includes(id));
    ids = [...lead, ...rest];
    if (t.foldRest) for (const id of rest) if (!hub.includes(id)) folded.add(id);
  }

  if (overlay) {
    for (const id of overlay.addAfterHero ?? []) if (!ids.includes(id)) ids.unshift(id);
    const pins = (overlay.pin ?? []).filter((id) => ids.includes(id));
    if (pins.length) {
      ids = [...pins, ...ids.filter((id) => !pins.includes(id))];
      for (const id of pins) folded.delete(id);
    }
    if (overlay.foldAfter !== undefined) {
      ids.forEach((id, i) => {
        if (i >= overlay.foldAfter! && !pins.includes(id)) folded.add(id);
      });
    }
  }

  if (folded.size > 0) {
    // Folded sections sit after the MORE_FOR_YOU header that holds them.
    const open = ids.filter((id) => !folded.has(id));
    const shut = ids.filter((id) => folded.has(id));
    ids = [...open, "MORE_FOR_YOU", ...shut];
  }
  ids.push("CLOSING"); // the renderer shows it to visitors only
  return { ids, folded };
}

function universalTop(): SectionId[] {
  return (C.layouts.UNIVERSAL as SectionId[]).slice(0, 6);
}

export function compose(decision: EvolutionDecision, tier: Tier, ctx: ComposeContext): UIState {
  const state = decision.primaryState;
  const mode = decision.behaviourMode;
  const t = C.tiers[tier];
  const overlay: ModeOverlay | null =
    t.overlay && mode !== "BALANCED" ? (C.modeOverlays[mode] as ModeOverlay) : null;

  const navMode: NavMode =
    ctx.stableNav || !t.navChanges ? "UNIVERSAL" : (C.states[state].nav as NavMode);
  const top = navList(navMode, ctx.signedIn);
  const bottom = top.filter((id) => id !== "PROFILE").slice(0, 5);

  const cta = overlay?.cta ?? (tier >= 1 ? C.states[state].cta : "EXPLORE_SWAYAM");
  const ledeKey = tier >= 1 ? `evo.lede.${state.toLowerCase()}` : "evo.lede.universal";

  const { ids, folded } = sectionOrder(state, tier, overlay);
  const density = overlay?.density ?? "standard";
  const sections: UISection[] = ids.map((id) => ({
    key: id,
    id,
    variant: density,
    span: SECTION_META[id].span,
    folded: folded.has(id),
  }));

  const before = universalTop();
  const movedUp = ids
    .filter((id) => !folded.has(id) && id !== "MORE_FOR_YOU")
    .slice(0, 6)
    .filter((id, i) => {
      const was = before.indexOf(id);
      return was === -1 || i < was;
    });

  const display: UIDisplay = {
    shortcutsRow: overlay?.shortcutsRow ?? C.display.shortcutsRow,
    showCompare: overlay?.showCompare ?? C.display.showCompare,
    showFilters: overlay?.showFilters ?? C.display.showFilters,
    itemsPerSection: overlay?.itemsPerSection ?? C.display.itemsPerSection,
  };

  const priorityActions = actionsFor(state, tier);
  const layout = tier === 0 ? "UNIVERSAL" : C.states[state].layout;

  return {
    renderKey: [
      state,
      mode,
      tier,
      navMode,
      layout,
      priorityActions.join(","),
      ctx.signedIn ? "m" : "v",
      ctx.stableNav ? "s" : "e",
      ctx.locked ? "L" : "",
    ].join("|"),
    state,
    mode,
    tier,
    density,
    navMode,
    layout,
    navigation: { top, bottom, overflow: overflowFor(top) },
    hero: { cta, ledeKey },
    priorityActions,
    sections,
    display,
    movedUp: state === "UNIVERSAL" && !overlay ? [] : movedUp,
    locked: ctx.locked,
  };
}

/** The neutral decision every new scope starts from. */
export const UNIVERSAL_DECISION: EvolutionDecision = Object.freeze({
  primaryState: "UNIVERSAL",
  behaviourMode: "BALANCED",
  navigationMode: "UNIVERSAL",
  homepageLayout: "UNIVERSAL",
  priorityActions: [...(C.priorityActions.UNIVERSAL as PriorityActionId[])],
  reason: "Learning how you use Swayam.",
  confidence: 0,
}) as EvolutionDecision;
