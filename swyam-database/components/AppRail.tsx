import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { NAV_BY_TYPE, useProfileType } from "../lib/profile-type";
import { useTx } from "../lib/i18n";
import { NAV_REGISTRY, pathOf } from "../evolution/config/navigation";
import type { NavItemId } from "../evolution/types";
import NavItems from "./evolution/NavItems";
import { useActiveNavItem } from "./evolution/use-nav";

/**
 * The signed-in member's own sections, down the left of a laptop screen.
 *
 * The product had three navigations and none of them was this one: a global
 * bar across the top, a horizontal strip of role links that scrolled away
 * with the page, and a menu drawer holding twenty-six destinations. So the
 * one thing a person uses every day — their own four or five sections — was
 * the thing that disappeared as soon as they scrolled.
 *
 * The rail is that list, pinned. It carries exactly the same destinations as
 * the phone's bottom bar, in the same words, because a product with two
 * vocabularies feels assembled rather than designed.
 *
 * Four things were wrong with the first cut.
 *
 * It appeared where it had nothing to say. Visibility was a hand-written
 * list of fourteen paths, so a school student landing on /skillswap got a
 * rail of six links — Study Plan, Subjects, Practice — none of which was the
 * page they were on, and none of which had anything to do with it. The rail
 * now derives visibility from the member's own items: it shows on their
 * dashboard and on the sections it actually lists, and nowhere else.
 *
 * It was glued to the window while the page was not. `container-x` centres
 * the page inside 80rem, so a rail pinned to `left: 0` sat against the
 * browser edge with two hundred-odd pixels of nothing between it and the
 * first word of the page it belonged to — and `lg:pl-60` on <main> made that
 * worse, because padding the wrapper re-centred the container further right.
 * The rail now starts at the container's own left edge and the content is
 * indented *inside* the container instead (`--rail-inset`, set here so the
 * two can never disagree).
 *
 * It was six paragraphs. Every item carried a line of explanation, useful
 * once — when you are deciding where to go — and noise on every visit after.
 * The explanation now belongs to the section you are in; the rest are labels
 * with an icon, which is what a person actually scans.
 *
 * It lit three items at once. Half the school student's sections are /coach
 * with a different hash, and the current-page test compared paths only.
 */

/*
 * Icons, labels and purpose lines come from the central destination registry,
 * so the rail, the phone's bottom bar and the top bar all say the same thing.
 */

/*
 * Where the rail belongs: pages that are about *you*.
 *
 * Deriving this from the member's own nav items was closer than the old
 * hand-written list, but still wrong, because most of those items point at a
 * catalogue. A school student's rail links to /courses, so the rail followed
 * them into the course catalogue — a page a signed-out stranger sees too,
 * with its own heading, its own filters and its own row of categories. Three
 * navigations on one screen, and the rail's answer to "where am I" was
 * "Beginner Courses", which is not where they were: they were in the
 * catalogue, looking at all thirty-nine.
 *
 * A catalogue is somewhere you go. It is not one of your areas. The rail
 * shows on the pages that hold your own work and nowhere else — it can still
 * link out to a catalogue without following you into it.
 */
const MINE = [
  "/dashboard",
  "/coach",
  "/applications",
  "/my-learning",
  "/passport",
  "/cv",
  "/saved",
  "/profile",
];

export default function AppRail() {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const type = useProfileType(user?.email ?? "", user?.role ?? "student", profileId);

  /*
   * Nothing until we know who this is. The old default — fall back to
   * `jobseeker` — drew a stranger's menu for the moment before the profile
   * type arrived, so a school student's first paint was Jobs, Applications,
   * CV Review. A rail that is briefly wrong is worse than one briefly absent.
   */
  const items: readonly NavItemId[] | null = user && type ? NAV_BY_TYPE[type] : null;
  const activeId = useActiveNavItem(items ?? []);
  const isMine = (id: NavItemId) => MINE.includes(pathOf(NAV_REGISTRY[id].member));
  /*
   * The rail draws only when it can point at the page you are on.
   *
   * Both earlier rules failed the same way from opposite ends. A hand-written
   * path list put the rail on /skillswap, where it listed six sections and
   * none of them was the page. Deriving it from the items themselves put it
   * on /courses, where the item it matched — "Beginner Courses" — was not
   * where the reader was either: they were in the catalogue looking at all
   * thirty-nine. And a list of personal paths put it on /profile, where a
   * school student's six items again had nothing to say.
   *
   * So the test is both halves at once: one of your items is the current
   * page, and that item is one of your own surfaces rather than a catalogue
   * you were only passing through. A navigation that cannot say "you are
   * here" is decoration, and this one now declines to draw itself.
   */
  const visible = !!items && activeId !== null && isMine(activeId);

  /*
   * One source of truth for the indent.
   *
   * The shell used to decide separately, from its own list of paths, whether
   * to pad the content — so any disagreement showed up as either a rail over
   * the text or a wide empty column. The rail is the only thing that knows
   * whether it is drawn, so it is the only thing that sets the inset.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--rail-inset");
      return;
    }
    root.style.setProperty("--rail-inset", "17.5rem");
    return () => {
      root.style.removeProperty("--rail-inset");
    };
  }, [visible]);

  if (!visible || !items) return null;

  return (
    <aside
      data-tour="nav"
      aria-label={tx("Your areas")}
      className="app-rail fixed z-30 hidden w-60 shrink-0 lg:block"
    >
      <nav className="h-full overflow-y-auto pb-8 pr-4">
        <NavItems items={items} surface="rail" signedIn className="flex flex-col gap-0.5" />
      </nav>
    </aside>
  );
}
