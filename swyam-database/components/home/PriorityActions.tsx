import type { ComponentType } from "react";
import {
  ArrowUpRight,
  Backpack,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ClipboardList,
  Compass,
  Dumbbell,
  Hammer,
  Library,
  MessagesSquare,
  PlayCircle,
  Presentation,
  Rocket,
  Search,
  Users,
} from "lucide-react";
import { PRIORITY_ACTIONS } from "@/evolution/config/actions";
import { EV } from "@/evolution/config/ids";
import { useEvolutionHydrated } from "@/evolution/react/hooks";
import { hrefFor } from "@/evolution/config/navigation";
import { track } from "@/evolution/runtime/tracker/track";
import type { Density, PriorityActionId } from "@/evolution/types";
import { useTx } from "@/lib/i18n";
import { EvolutionStage } from "@/components/motion/EvolutionStage";
import HrefLink from "./HrefLink";

/* The registry names a lucide icon; an unknown name falls back to Compass. */
const ICONS: Record<
  string,
  ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>
> = {
  Backpack,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ClipboardList,
  Compass,
  Dumbbell,
  Hammer,
  Library,
  MessagesSquare,
  PlayCircle,
  Presentation,
  Rocket,
  Search,
  Users,
};

/**
 * The four large tiles under the hero. 2x2 on phones, one row from tablet up.
 * Every tile is a real destination from the registry; hints step aside in
 * compact density but the label and the link never do.
 */
export default function PriorityActions({
  actions,
  signedIn,
  density,
}: {
  actions: ReadonlyArray<PriorityActionId>;
  signedIn: boolean;
  density: Density;
}) {
  const tx = useTx();
  const hydrated = useEvolutionHydrated();
  return (
    <nav className="evo-actions-nav container-x pb-10 lg:pb-14" aria-label={tx("Quick actions")}>
      {/*
        The tiles are a stage of their own: when the evolution swaps or reorders them they glide with the
        same spring as the sections below, one after another. No glow here; the sections carry the
        "thinking" moment and the tiles just make room.
      */}
      <EvolutionStage
        as="ul"
        itemAs="li"
        groupId="evo-actions"
        items={actions}
        getKey={(id) => id}
        highlight={false}
        itemClassName="min-w-0"
        className="evo-actions grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        data-density={density}
        data-evo-region="actions"
        data-hydrated={hydrated ? "true" : undefined}
        renderItem={(id) => {
          const a = PRIORITY_ACTIONS[id];
          const Icon = ICONS[a.icon] ?? Compass;
          const i = actions.indexOf(id);
          return (
            <>
              <HrefLink
                href={hrefFor(a.nav, signedIn)}
                onClick={() =>
                  track(EV.RECOMMENDATION_CLICKED, {
                    surface: "home-actions",
                    rank: i + 1,
                    via: "adaptive",
                  })
                }
                className="evo-tile card group flex h-full min-h-[7.5rem] flex-col justify-between gap-3 p-4 sm:p-5"
              >
                <span className="evo-tile-top flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron-50 text-saffron-600">
                    <Icon size={20} aria-hidden />
                  </span>
                  <ArrowUpRight size={16} className="evo-tile-arrow text-ink-soft" aria-hidden />
                </span>
                <span className="block min-w-0">
                  <span className="evo-tile-label block font-display text-[1.05rem] font-semibold leading-tight text-ink">
                    {tx(a.label)}
                  </span>
                  {density !== "compact" && (
                    <span className="evo-tile-hint mt-1 block font-body text-[12.5px] leading-snug text-ink-mute">
                      {tx(a.hint)}
                    </span>
                  )}
                </span>
              </HrefLink>
            </>
          );
        }}
      />
    </nav>
  );
}
