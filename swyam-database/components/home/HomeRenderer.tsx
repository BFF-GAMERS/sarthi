import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { EvolutionStage } from "@/components/motion/EvolutionStage";
import { EV } from "@/evolution/config/ids";
import { NAV_REGISTRY, hrefFor } from "@/evolution/config/navigation";
import { useEvolutionHydrated, useHomePlan, useNavPlan } from "@/evolution/react/hooks";
import { track } from "@/evolution/runtime/tracker/track";
import type { SectionId, UISection } from "@/evolution/types";
import { useAuth } from "@/context/AuthContext";
import { useTx } from "@/lib/i18n";
import { useEmptySections } from "./empty";
import HeroSection from "./HeroSection";
import HrefLink from "./HrefLink";
import PriorityActions from "./PriorityActions";
import { flowCells, groupRows, splitSections } from "./plan";
import { REGISTRY } from "./registry";
import type { SectionProps } from "./types";

/** How long a fresh "Moved up for you" label keeps its emphasis. */
const FRESH_MS = 4000;
/** At most this many sections are highlighted per change; more than two is noise. */
const MAX_PROMOTED = 2;

/**
 * The adaptive Home: hero, priority actions, then the sections in the order the
 * compiled plan says. All of it is structure (order, density, which section
 * leads). Nothing here picks a colour; the plan has no paint fields.
 *
 * The main list is one EvolutionStage on a flat grid, so when the plan reorders
 * or swaps sections they glide to their new place on a spring, the promoted ones
 * leading and their neighbours following, and the promoted ones get a brief
 * highlight. Sections are keyed, so form fields, scroll positions and query data
 * survive the move; reduced motion reorders at once.
 */
export default function HomeRenderer() {
  const tx = useTx();
  const plan = useHomePlan();
  const hydrated = useEvolutionHydrated();
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const [everOpened, setEverOpened] = useState(false);
  const empty = useEmptySections(signedIn);

  /*
   * No animation on arrival. The server renders the universal plan and the store swaps in the learned one
   * when it hydrates; that swap is not an evolution and must not glide or glow. So when hydration brings a
   * different plan than the one the page was built with, the stages mount afresh (a stage never animates
   * its first set of items). Behind the D3 gate nobody sees the swap. A plan that did not change keeps
   * its stage.
   */
  const [boot, setBoot] = useState({ key: plan.renderKey, hydrated, epoch: 0 });
  if (hydrated && !boot.hydrated)
    setBoot({ key: boot.key, hydrated: true, epoch: plan.renderKey === boot.key ? 0 : 1 });

  const { main, folded, closing } = useMemo(
    () => splitSections(plan.sections, signedIn),
    [plan.sections, signedIn],
  );
  /* Sections that would render nothing take no cell, so their neighbours close up. */
  const stageItems = useMemo(() => main.filter((s) => !empty.has(s.id)), [main, empty]);
  const cells = useMemo(() => flowCells(stageItems), [stageItems]);
  const movedKeys = useMemo(
    () => stageItems.filter((s) => plan.movedUp.includes(s.id)).map((s) => s.key),
    [stageItems, plan.movedUp],
  );
  const moved = useMemo(() => new Set<SectionId>(plan.movedUp), [plan.movedUp]);

  /* "Moved up for you" keeps a quiet record. A fresh move also earns a few seconds of emphasis, but the
     clock starts when the promoted section is actually on screen (IntersectionObserver), not when the plan
     changes: a section that moved up below the fold would otherwise spend its four seconds unseen. */
  const [fresh, setFresh] = useState<ReadonlySet<SectionId>>(() => new Set());
  const [pending, setPending] = useState<ReadonlyArray<SectionId>>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const seen = useRef({ key: plan.renderKey, armed: hydrated });
  useEffect(() => {
    if (!hydrated) return;
    if (!seen.current.armed) {
      seen.current = { key: plan.renderKey, armed: true };
      return;
    }
    if (seen.current.key === plan.renderKey) return;
    seen.current.key = plan.renderKey;
    setPending(plan.movedUp.slice(0, MAX_PROMOTED));
  }, [hydrated, plan.renderKey, plan.movedUp]);

  useEffect(() => {
    if (pending.length === 0) return;
    const timers: number[] = [];
    const start = (id: SectionId) => {
      setFresh((prev) => new Set(prev).add(id));
      timers.push(
        window.setTimeout(() => {
          setFresh((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, FRESH_MS),
      );
    };
    const root = rootRef.current;
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined" || !root) {
      pending.forEach(start);
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            observer.unobserve(e.target);
            start((e.target as HTMLElement).dataset["section"] as SectionId);
          }
        },
        { threshold: 0.3 },
      );
      io = observer;
      for (const id of pending)
        root.querySelectorAll(`[data-section="${id}"]`).forEach((el) => observer.observe(el));
    }
    return () => {
      io?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      setFresh(new Set());
    };
  }, [pending]);

  /* Reading order, 1-based, across the stage, the fold and the closing band. */
  const position = useMemo(() => {
    const m = new Map<SectionId, number>();
    [...stageItems, ...folded, ...(closing ? [closing] : [])].forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [stageItems, folded, closing]);

  const body = (s: UISection): ReactNode => {
    const Section = REGISTRY[s.id];
    const props: SectionProps = {
      id: s.id,
      variant: s.variant,
      display: plan.display,
      position: position.get(s.id) ?? 0,
      layout: plan.layout,
      signedIn,
      defaultSlot: plan.layout === "UNIVERSAL",
    };
    return <Section {...props} />;
  };

  /* The fold and the closing band sit outside the stage: plain slots on the old rows. */
  const plainSlot = (s: UISection): ReactNode => (
    <section
      key={s.key}
      data-section={s.id}
      data-span-tablet={s.span.tablet}
      data-span-desktop={s.span.desktop}
      data-moved={moved.has(s.id) ? tx("Moved up for you") : undefined}
      className="evo-slot"
    >
      {body(s)}
    </section>
  );

  const rows = (list: ReadonlyArray<UISection>): ReactNode =>
    groupRows(list).map((row) =>
      row.kind === "bleed" ? (
        plainSlot(row.items[0]!)
      ) : (
        <div
          key={`row:${row.items[0]!.key}`}
          className="evo-row container-x"
          data-count={row.items.length}
        >
          {row.items.map(plainSlot)}
        </div>
      ),
    );

  return (
    <div ref={rootRef} className="relative z-10 overflow-clip">
      <HeroSection hero={plan.hero} state={plan.state} tier={plan.tier} hydrated={hydrated} />
      {/* The same four doors as the top menu; a first visit does not need them twice. */}
      {plan.state !== "UNIVERSAL" && (
        <PriorityActions
          key={`actions-${boot.epoch}`}
          actions={plan.priorityActions}
          signedIn={signedIn}
          density={plan.density}
        />
      )}
      {plan.display.shortcutsRow && <ShortcutsRow signedIn={signedIn} />}

      <EvolutionStage
        key={`stage-${boot.epoch}`}
        groupId="evo-home"
        items={stageItems}
        getKey={(s) => s.key}
        itemAs="section"
        itemClassName="evo-slot"
        highlightRadius="var(--radius-card, 14px)"
        maxHighlighted={MAX_PROMOTED}
        promotedKeys={movedKeys.length > 0 ? movedKeys.slice(0, MAX_PROMOTED) : undefined}
        getItemAttrs={(s) => {
          const c = cells.get(s.key);
          return {
            "data-section": s.id,
            "data-moved": moved.has(s.id) ? tx("Moved up for you") : undefined,
            "data-fresh": fresh.has(s.id) ? "true" : undefined,
            "data-bleed": c?.bleed ? "true" : undefined,
            "data-tf": c?.tabletFull ? "true" : undefined,
            "data-tj": c ? String(c.tj) : undefined,
            "data-df": c?.desktopFull ? "true" : undefined,
            "data-dc": c ? String(c.dc) : undefined,
            "data-dj2": c ? String(c.dj2) : undefined,
            "data-dj3": c ? String(c.dj3) : undefined,
            "data-last": c?.last ? "true" : undefined,
          };
        }}
        renderItem={body}
        data-evo-region="home"
        data-hydrated={hydrated ? "true" : undefined}
        data-density={plan.density}
        data-state={plan.state}
        data-tier={plan.tier}
        data-layout={plan.layout}
        className="evo-home evo-flow"
      />

      {folded.length > 0 && (
        <details
          className="evo-more container-x"
          onToggle={(e) => {
            if (!e.currentTarget.open) return;
            setEverOpened(true);
            track(EV.DASHBOARD_SECTION_CLICKED, {
              section: "MORE_FOR_YOU",
              position: main.length + 1,
              layout: plan.layout,
            });
          }}
        >
          <summary className="evo-more-summary flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-card)] border border-ink-line bg-paper-light px-5 py-4 font-display text-[1.05rem] font-semibold text-ink">
            <span>
              {tx("More for you")}
              <span className="ml-2 font-body text-[13px] font-normal text-ink-mute">
                {folded.length} {tx("more sections")}
              </span>
            </span>
            <ChevronDown size={18} aria-hidden className="evo-more-chevron shrink-0" />
          </summary>
          {everOpened && <div className="evo-more-body">{rows(folded)}</div>}
        </details>
      )}

      {closing && plainSlot(closing)}
    </div>
  );
}

/** QUICK mode: one row of links to the main destinations, never a replacement for them. */
function ShortcutsRow({ signedIn }: { signedIn: boolean }) {
  const tx = useTx();
  const nav = useNavPlan();
  const ids = nav.top.filter((id) => id !== "HOME" && id !== "PROFILE");
  return (
    <nav className="container-x pb-8" aria-label={tx("Shortcuts")}>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id, i) => (
          <li key={id}>
            <HrefLink
              href={hrefFor(id, signedIn)}
              onClick={() =>
                track(EV.RECOMMENDATION_CLICKED, {
                  surface: "home-shortcuts",
                  rank: i + 1,
                  via: "adaptive",
                })
              }
              className="chip hover:bg-saffron-50 hover:text-saffron-700"
            >
              {NAV_REGISTRY[id].label}
            </HrefLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
