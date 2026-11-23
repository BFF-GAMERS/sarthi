/**
 * The slot under the hero CTA. In a learned state it is the three-item lead strip (the state's own
 * three doors); in UNIVERSAL it is one quiet "Watch Swayam adapt" link into the Lab. Same slot, same
 * height, so the hero never changes size when the state does.
 */
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { EV } from "@/evolution/config/ids";
import { hrefFor } from "@/evolution/config/navigation";
import { track } from "@/evolution/runtime/tracker/track";
import type { EvolutionState } from "@/evolution/types";
import { useTx } from "@/lib/i18n";
import HrefLink from "../HrefLink";
import { LEAD_STRIPS, WATCH_ADAPT_HREF } from "./model";

export default function LeadStrip({
  state,
  signedIn,
  className = "",
  style,
}: {
  state: EvolutionState;
  signedIn: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const tx = useTx();
  const items = LEAD_STRIPS[state];

  if (items.length === 0) {
    return (
      <div className={`hero-lead hero-lead-watch ${className}`} style={style}>
        <HrefLink
          href={WATCH_ADAPT_HREF}
          className="hero-watch"
          onClick={() =>
            track(EV.RECOMMENDATION_CLICKED, { surface: "home-hero", rank: 0, via: "adaptive" })
          }
        >
          <span className="hero-watch-live" aria-hidden>
            <span className="hero-watch-dot" />
            {tx("Live demo")}
          </span>
          <span className="hero-watch-label">{tx("Watch स्वYAM adapt")}</span>
          {/* A 3-tab mini preview that keeps re-ordering itself: the idea in one glance. Decorative only. */}
          <span className="hero-watch-mini" aria-hidden>
            <span className="hw-chip hw-a">{tx("Learn")}</span>
            <span className="hw-chip hw-b">{tx("Jobs")}</span>
            <span className="hw-chip hw-c">{tx("Skills")}</span>
          </span>
          <ArrowRight size={15} aria-hidden className="hero-watch-arrow" />
        </HrefLink>
      </div>
    );
  }

  return (
    <nav className={`hero-lead ${className}`} style={style} aria-label={tx("Jump in")}>
      <ul className="hero-lead-list">
        {items.map((it, i) => (
          <li key={it.nav} className="min-w-0">
            <HrefLink
              href={hrefFor(it.nav, signedIn)}
              className="hero-lead-item"
              onClick={() =>
                track(EV.RECOMMENDATION_CLICKED, {
                  surface: "home-hero",
                  rank: i + 1,
                  via: "adaptive",
                })
              }
            >
              <span className="truncate">{tx(it.label)}</span>
              <ArrowUpRight size={14} aria-hidden className="shrink-0" />
            </HrefLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
