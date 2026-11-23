import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Wordmark } from "./Brand";
import { ChevronStripe } from "./Ornaments";
import { useT, useTx } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { EV } from "../evolution/config/ids";
import { useUiState } from "../evolution/react/hooks";
import { track } from "../evolution/runtime/tracker/track";
import type { NavItemId } from "../evolution/types";

/**
 * The end of the page: a navy panel inset from the page edges, so it reads
 * as the last card rather than as a slab the page runs into.
 *
 * In the dark register `.ink-block` resolves to a pale card (it borrows the
 * flipped paper token for its fill), which left near-white links on a near-white
 * ground. `.footer-card` (styles.css) pairs light type with the dark elevation
 * ladder instead, so every link here clears 4.5:1 in both registers.
 *
 * Three link columns is the whole sitemap; the brand column carries the one
 * line the platform says about itself and the one action it wants.
 */

const rows = [
  {
    title: "Discover",
    key: "discover" as const,
    links: [
      { label: "Explore", to: "/explore" as const, id: "EXPLORE" as NavItemId },
      { label: "Courses", to: "/courses" as const, id: "COURSES" as NavItemId },
      { label: "Jobs & Internships", to: "/jobs" as const, id: "JOBS" as NavItemId },
      { label: "Skill board", to: "/board" as const, id: "SKILL_BUILDER" as NavItemId },
      { label: "Skills", to: "/skills" as const, id: "SKILL_DIRECTORY" as NavItemId },
      { label: "Events", to: "/events" as const, id: "EVENTS" as NavItemId },
    ],
  },
  {
    title: "For You",
    key: "forYou" as const,
    links: [
      { label: "Dashboard", to: "/dashboard" as const, id: "DASHBOARD" as NavItemId },
      { label: "Skill Passport", to: "/passport" as const, id: "PASSPORT" as NavItemId },
      { label: "CV review", to: "/cv" as const, id: "CV" as NavItemId },
      { label: "Community", to: "/community" as const, id: "COMMUNITY" as NavItemId },
      { label: "Rewards", to: "/rewards" as const, id: "REWARDS" as NavItemId },
    ],
  },
  {
    title: "The Mission",
    key: "mission" as const,
    links: [
      { label: "About Us", to: "/about" as const },
      { label: "Trust center", to: "/trust" as const, id: "TRUST" as NavItemId },
      { label: "Schemes", to: "/schemes" as const, id: "SCHEMES" as NavItemId },
      { label: "Knowledge Base", to: "/resources" as const, id: "RESOURCES" as NavItemId },
      { label: "Evolution Lab", to: "/lab" as const, id: "LAB" as NavItemId },
      { label: "Contact", to: "/contact" as const },
      { label: "Privacy", to: "/privacy" as const },
      { label: "Terms of use", to: "/terms" as const },
    ],
  },
];

export default function Footer() {
  const tx = useTx();
  const t = useT();
  const { user } = useAuth();
  const { state } = useUiState();

  return (
    <footer className="relative z-10 pb-5 pt-16 sm:pb-8">
      <div className="container-x">
        <div className="ink-block footer-card overflow-hidden rounded-[2rem] px-6 pb-8 pt-12 text-paper-light sm:px-10 sm:pt-14 lg:px-14">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
            {/* Brand column */}
            <div>
              <Wordmark size="xl" tone="paper" />
              <p className="mt-3 font-devanagari text-lg text-paper-light/70">
                कौशल भारत, कुशल भारत
              </p>
              {/*
                Four verbs instead of a sentence about an ecosystem. The line it
                replaced named a category rather than a product, which is the
                one thing a footer has no room for.
              */}
              <p className="mt-5 font-display text-[1.35rem] font-semibold leading-snug tracking-tight text-paper-light">
                {tx("Learn. Prove. Exchange. Get hired.")}
              </p>
              <p className="mt-3 max-w-sm font-body text-[14px] leading-relaxed text-paper-light/70">
                {tx(
                  "Courses that end in an assessment, skills you can trade, and a certificate anyone can check.",
                )}
              </p>
              {!user && (
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="btn-primary mt-7 !py-2.5 !text-[13px]"
                >
                  {tx("Start free")} <ArrowUpRight size={15} aria-hidden />
                </Link>
              )}
            </div>

            {/* Sitemap */}
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              {rows.map((r) => (
                <nav key={r.title} aria-label={t(r.key)}>
                  {/*
                      A label, not a heading.

                      The <nav> already carries aria-label with the same
                      words, so this was announcing the column twice — and as
                      an h3 directly under the page's h1 it skipped a level,
                      which axe flags on every page that has a footer. A
                      paragraph says the same thing to the eye and nothing
                      extra to a screen reader.
                  */}
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-saffron-glow">
                    {t(r.key)}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {r.links.map((l, i) => (
                      <li key={l.label}>
                        <Link
                          to={l.to}
                          onClick={() => {
                            if ("id" in l && l.id) {
                              track(EV.NAVIGATION_ITEM_CLICKED, {
                                item: l.id,
                                surface: "footer",
                                position: i,
                                state,
                              });
                            }
                          }}
                          className="font-body text-[15px] text-paper-light/80 transition-colors hover:text-paper-light"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <ChevronStripe height={3} className="opacity-80" />
          </div>

          <p className="mt-6 flex flex-wrap justify-between gap-x-6 gap-y-2 font-body text-[12.5px] text-paper-light/60">
            <span>© 2026 स्वYAM — {tx("skilling, swapping and hiring in one place")}</span>
            <span>{tx("Built for learners across India")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
