import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useAuth } from "../context/AuthContext";
import { hasStableNav, stableBottomFor, useProfileType } from "../lib/profile-type";
import { useTx } from "../lib/i18n";
import { useEvolutionHydrated, useNavPlan } from "../evolution/react/hooks";
import { bottomSlots } from "./evolution/nav-model";
import NavItems from "./evolution/NavItems";

/**
 * The phone's navigation.
 *
 * On a phone every screen on this site began with a hamburger: the menu was
 * a drawer, the drawer was a list of twenty-six links, and getting from a
 * course back to your applications was three taps through a modal. That is a
 * website's navigation on a device where people expect an app's.
 *
 * Five destinations, at the bottom, in the member's own words — the same
 * five their dashboard navigation names, because two vocabularies for one
 * product is how a platform starts to feel assembled rather than designed.
 * It is the thumb's job, so it sits in the thumb's half of the screen, keeps
 * a 56px target, and respects the home indicator.
 *
 * It is not shown on a laptop, where the bar across the top already holds
 * everything, and never while reading a lesson.
 */

/*
 * Five slots: Home plus the four middle items of the current navigation plan
 * (Explore sits in the plan and goes to /explore). Recruiters and institutes
 * keep their own fixed lists (D5). The list is keyed by destination id, so an
 * item that stays keeps its place when the plan changes.
 */

export default function BottomNav() {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const type = useProfileType(user?.email ?? "", user?.role ?? "student", profileId);
  const { pathname } = useLocation();
  const plan = useNavPlan();
  const hydrated = useEvolutionHydrated();

  // A lesson is full-screen reading; a wizard is a wizard. Neither wants a
  // navigation bar across the bottom of it.
  const hidden = pathname.startsWith("/learn/") || pathname.startsWith("/auth");

  // A type-specific list is only used once the type is known; until then (and
  // for everyone else) the bar follows the evolution plan, never a guessed list.
  const items = user && hasStableNav(type) ? stableBottomFor(type) : bottomSlots(plan.top);

  /*
   * Tell the page how much room to leave. The bar is fixed, so without this
   * every page's last element sits underneath it — which is exactly the kind
   * of thing that makes a site feel unfinished on a phone.
   */
  useEffect(() => {
    const root = document.documentElement;
    /*
     * Only while the bar is actually on screen.
     *
     * The bar is hidden by CSS above 1024px, but this effect set the variable
     * at every width — so on a laptop the page reserved 68px for a bar that
     * was not there. Everything anchored to the bottom floated that far up,
     * which is why Ask Sarthi sat in mid-air rather than in the corner, and
     * why every page carried a band of dead space under its last element.
     *
     * The media query is the same 1024px breakpoint as `lg:hidden`, and it
     * is watched rather than read once, so resizing a window keeps the two
     * in agreement.
     */
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      root.style.setProperty(
        "--bottom-bar",
        hidden || wide.matches ? "0px" : "calc(4.25rem + env(safe-area-inset-bottom))",
      );
    };
    apply();
    wide.addEventListener("change", apply);
    return () => {
      wide.removeEventListener("change", apply);
      root.style.setProperty("--bottom-bar", "0px");
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav
      data-tour="nav"
      data-evo-region="nav-bottom"
      data-hydrated={hydrated ? "true" : "false"}
      aria-label={tx("Main")}
      className="bottom-bar fixed inset-x-0 bottom-0 z-[60] border-t border-ink-line pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <NavItems
        items={items}
        surface="bottom"
        signedIn={Boolean(user)}
        className="mx-auto flex max-w-lg items-stretch sm:max-w-2xl"
      />
    </nav>
  );
}
