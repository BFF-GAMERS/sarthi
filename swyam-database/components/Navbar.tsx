import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  ChevronDown,
  Ellipsis,
  Globe,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Sun,
  ShoppingCart,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import { useTheme, useLanguage } from "../context/PreferencesContext";
import { useT, useTx } from "../lib/i18n";
import { SUPPORTED_LANGUAGES, languageFor } from "../lib/languages";
import { CART_EVENT, readCart } from "../lib/catalogue";
import { Wordmark } from "./Brand";
import { hrefFor } from "../evolution/config/navigation";
import { useEvolutionHydrated, useNavPlan } from "../evolution/react/hooks";
import type { NavItemId } from "../evolution/types";
import AdaptingIndicator from "./evolution/AdaptingIndicator";
import NavItems, { NavIcon, NavLinkItem } from "./evolution/NavItems";
import ThemeControl from "./evolution/ThemeControl";
import AppearanceSync from "../appearance/AppearanceSync";
import { AVATAR_MENU_ITEMS, DOMAIN_HEADING, middleLinks, parseHref } from "./evolution/nav-model";
import { useActiveNavItem, useInstantMotion, useNavLabel } from "./evolution/use-nav";

/**
 * Every destination, label and route in this bar comes from the central
 * registry (src/evolution/config/navigation.ts); the evolution plan only
 * decides which four sit in the bar and in what order. Everything else stays
 * one click away in the Explore / More menu, grouped by domain.
 */

/** Closes a popover when a link inside it is chosen. */
const closeOnLink = (close: () => void) => (e: React.MouseEvent) => {
  if ((e.target as HTMLElement).closest("a")) close();
};

/**
 * The navigation: a floating island rather than a bar across the page.
 *
 * It sits a little below the top edge with the page visible around it, so
 * the hero starts at the top of the viewport and the chrome reads as a
 * control rather than a ceiling. It blurs what scrolls under it and picks up
 * a stronger shadow once the page has moved.
 */
export default function Navbar() {
  const tx = useTx();
  const { user, logout } = useAuth();
  const { mode, toggle } = useTheme();
  const t = useT();
  const { code: langCode, setLanguage } = useLanguage();
  const [drawer, setDrawer] = useState(false);
  const signedIn = Boolean(user);
  const plan = useNavPlan();
  const hydrated = useEvolutionHydrated();
  const instant = useInstantMotion();
  const middle = useMemo(() => middleLinks(plan.top), [plan.top]);
  const hasExplore = middle.includes("EXPLORE");
  const activeId = useActiveNavItem(middle);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);

  // The cart lives on the device, so the badge listens rather than queries.
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const sync = () => setCartCount(readCart().length);
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  useEffect(() => {
    if (!exploreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!exploreRef.current?.contains(e.target as Node)) setExploreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExploreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [exploreOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <AppearanceSync />
      {/*
        The page slides under a floating island, and the island is a rounded
        pill: content kept appearing in the gaps beside and below it, sliced
        in half, which reads as a rendering fault rather than as scrolling.
        Once the page has moved, a full-width veil goes behind the island —
        the content ends cleanly at the top of the screen and the island
        still floats.
      */}
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[4.75rem] border-b transition-opacity duration-300 sm:h-[5.25rem] ${
          scrolled ? "border-ink-line bg-paper/90 opacity-100" : "border-transparent opacity-0"
        }`}
      />
      <div className="container-x relative pt-3 sm:pt-4">
        <nav
          className={`nav-island pointer-events-auto relative flex h-14 flex-nowrap items-center justify-between gap-2 pl-2 pr-2 max-[379px]:gap-1 sm:pl-3 ${
            scrolled ? "shadow-[var(--shadow-float)]" : ""
          }`}
          aria-label={tx("Main navigation")}
        >
          {/* Menu + wordmark */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setDrawer(true)}
              aria-label={tx("More")}
              title={tx("More")}
              aria-expanded={drawer}
              aria-haspopup="dialog"
              className="nav-icon"
            >
              <Menu size={19} aria-hidden />
            </button>
            <Link
              to="/"
              className="flex shrink-0 items-center px-1.5 transition-opacity duration-200 hover:opacity-80 max-[379px]:px-1"
              aria-label={tx("स्वYAM home")}
            >
              <Wordmark size="md" />
            </Link>
          </div>

          {/* Primary links: the four middle items of the evolution plan, from the registry. */}
          <div
            className="relative hidden min-w-0 lg:block"
            ref={exploreRef}
            data-evo-region="nav-top"
            data-hydrated={hydrated ? "true" : "false"}
          >
            <LayoutGroup id="evo-nav-top">
              <ul className="flex items-center gap-0.5">
                {middle.map((id, i) => (
                  <motion.li
                    key={id}
                    layout={instant ? false : "position"}
                    data-nav-item={id}
                    className="flex items-center"
                  >
                    <NavLinkItem
                      id={id}
                      surface="top"
                      signedIn={signedIn}
                      position={i}
                      active={activeId === id}
                    />
                    {id === "EXPLORE" && (
                      <button
                        onClick={() => setExploreOpen((v) => !v)}
                        aria-expanded={exploreOpen}
                        aria-haspopup="true"
                        aria-label={tx("More destinations")}
                        className={`nav-icon -ml-1.5 !h-9 !w-8 ${exploreOpen ? "!text-ink" : ""}`}
                      >
                        <ChevronDown
                          size={14}
                          aria-hidden
                          className={`transition-transform duration-300 ${exploreOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </motion.li>
                ))}
                {/* SkillSwap is always one click away on wide screens, whatever the adaptive four are.
                    It is not added to `middle`, so the phone's five-slot bottom bar is unchanged. */}
                {!middle.includes("SKILLS") && (
                  <motion.li
                    key="evo-skillswap"
                    data-tour="home-skillswap"
                    layout={instant ? false : "position"}
                    data-nav-item="SKILLS"
                    className="flex items-center"
                  >
                    <NavLinkItem
                      id="SKILLS"
                      surface="top"
                      signedIn={signedIn}
                      position={middle.length}
                      active={activeId === "SKILLS"}
                    />
                  </motion.li>
                )}
                {!hasExplore && (
                  <motion.li
                    key="evo-more"
                    layout={instant ? false : "position"}
                    className="flex items-center"
                  >
                    {/* Label and chevron from xl; a single "more" icon when the island is tight. */}
                    <button
                      onClick={() => setExploreOpen((v) => !v)}
                      aria-expanded={exploreOpen}
                      aria-haspopup="true"
                      aria-label={tx("More destinations")}
                      title={tx("More destinations")}
                      className={`nav-link nvx-more gap-1 ${exploreOpen ? "!text-ink" : ""}`}
                    >
                      <span className="nvx-more-label">{tx("More")}</span>
                      <ChevronDown
                        size={14}
                        aria-hidden
                        className={`nvx-more-chev transition-transform duration-300 ${exploreOpen ? "rotate-180" : ""}`}
                      />
                      <Ellipsis size={18} aria-hidden className="nvx-more-dots" />
                    </button>
                  </motion.li>
                )}
              </ul>
            </LayoutGroup>

            <AnimatePresence>
              {exploreOpen && (
                <motion.div
                  initial={{ y: -6, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: instant ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                  data-lenis-prevent
                  onClick={closeOnLink(() => setExploreOpen(false))}
                  className="absolute left-1/2 z-50 mt-3 max-h-[min(34rem,calc(100dvh-7rem))] w-[min(58rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-3xl border border-ink-line bg-paper-light p-3 shadow-[var(--shadow-float)]"
                >
                  <div className="grid grid-cols-3 gap-1 xl:grid-cols-5">
                    {plan.overflow.map((g) => (
                      <div key={g.domain} className="p-2">
                        <p className="kicker px-2 !text-[10.5px]">{tx(DOMAIN_HEADING[g.domain])}</p>
                        <NavItems
                          items={g.items}
                          surface="more"
                          signedIn={signedIn}
                          className="evo-nav-compact mt-2 space-y-0.5"
                        />
                      </div>
                    ))}
                  </div>
                  {!hasExplore && (
                    <div className="mt-1 border-t border-ink-line pt-1">
                      <NavItems
                        items={["EXPLORE"]}
                        surface="more"
                        signedIn={signedIn}
                        className="evo-nav-compact"
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            {/* A globe from xl, with the language name from 1500px; the drawer always has the full picker. */}
            <span className="hidden xl:inline-flex">
              <LanguagePicker code={langCode} onChange={setLanguage} surface="nav" />
            </span>
            {/* "Your Swayam" status dot at every width: a 14 px mark in a 44 px target, no label to clip.
                Its tooltip and accessible name are the full sentence; it opens the Your Swayam panel. */}
            <AdaptingIndicator variant="nav" className="shrink-0" />
            {/* The drawer carries the full Light / Dark / System control; this is the one-tap flip.
                Hidden on the narrowest phones (360px has no room) and 1024-1279px (the island is tight). */}
            <ModeSwitch
              mode={mode}
              onToggle={toggle}
              className="nvx-mode-quick max-[419px]:hidden"
            />
            {/* Under 340px the status dot keeps the room; Search is one tap away in the menu drawer. */}
            <span className="inline-flex max-[339px]:hidden">
              <IconBtn label={t("search")} onClick={() => navigate({ to: "/search" })}>
                <Search size={17} />
              </IconBtn>
            </span>
            {cartCount > 0 && (
              <IconBtn
                label={`Cart, ${cartCount} course${cartCount === 1 ? "" : "s"}`}
                onClick={() => navigate({ to: "/cart" })}
              >
                <ShoppingCart size={17} />
                <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-saffron-500 font-body text-[9px] font-bold text-on-accent">
                  {cartCount}
                </span>
              </IconBtn>
            )}
            {user ? (
              <>
                <span className="nvx-msg hidden sm:inline-flex">
                  <IconBtn label="Messages" onClick={() => navigate({ to: "/messages" })}>
                    <MessageSquare size={17} />
                  </IconBtn>
                </span>
                <NotificationBell />
                <div className="relative ml-1" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full border border-ink-line bg-paper-light py-1 pl-1 pr-1 transition-[background-color,border-color] duration-200 hover:border-saffron-200 hover:bg-saffron-50 sm:pr-3"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      src={user.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="nvx-uname hidden whitespace-nowrap font-body text-[13px] font-semibold sm:inline">
                      {user.name.split(" ")[0]}
                    </span>
                  </button>
                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={{ y: -6, opacity: 0.6 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-ink-line bg-paper-light p-1.5 shadow-[var(--shadow-float)]"
                        role="menu"
                      >
                        {AVATAR_MENU_ITEMS.map((id) => (
                          <MenuLink key={id} id={id} onDone={() => setMenuOpen(false)} />
                        ))}
                        <MenuItem
                          icon={<ShoppingCart size={15} />}
                          label="Cart"
                          onClick={() => {
                            setMenuOpen(false);
                            navigate({ to: "/cart" });
                          }}
                        />
                        <div className="my-1 border-t border-ink-line" />
                        <MenuItem
                          icon={<LogOut size={15} />}
                          label="Log out"
                          onClick={() => {
                            setMenuOpen(false);
                            logout();
                            navigate({ to: "/" });
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="ml-1 flex shrink-0 items-center gap-1.5 max-[379px]:ml-0">
                {/* Never wraps or shrinks. Below xl "Log in" lives in the drawer and on /auth. */}
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className="nvx-login hidden shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-2 font-body text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-dim sm:inline-flex"
                >
                  {t("logIn")}
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="btn-primary shrink-0 whitespace-nowrap !px-3.5 !py-2 !text-[13px] max-[379px]:!px-3 sm:!px-4"
                >
                  {t("joinFree")}
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* ── Drawer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              aria-label={tx("Close menu")}
              className="pointer-events-auto fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-label={t("menu")}
              className="pointer-events-auto fixed left-0 top-0 z-50 flex h-dvh w-[min(24rem,100vw)] flex-col bg-paper-light shadow-[var(--shadow-float)] sm:left-3 sm:top-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-[1.75rem] sm:border sm:border-ink-line"
            >
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                {user ? (
                  <span className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-body text-[15px] font-semibold text-ink">
                        {user.name}
                      </span>
                      <span className="block truncate font-body text-[12px] text-ink-mute">
                        {user.email}
                      </span>
                    </span>
                  </span>
                ) : (
                  <Wordmark size="md" />
                )}
                <button
                  onClick={() => setDrawer(false)}
                  aria-label={tx("Close menu")}
                  className="nav-icon"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Primary destinations, large (phone; the top bar holds them on a laptop). */}
              <div className="px-3 lg:hidden" onClick={closeOnLink(() => setDrawer(false))}>
                <NavItems
                  items={middle}
                  surface="drawer"
                  signedIn={signedIn}
                  className="evo-nav-primary space-y-0.5 border-b border-ink-line pb-3"
                />
              </div>

              {/* Everything else, grouped by domain. Account items live in the avatar menu. */}
              <div
                className="flex-1 overflow-y-auto px-3 py-3"
                data-lenis-prevent
                onClick={closeOnLink(() => setDrawer(false))}
              >
                {plan.overflow.map((g) => (
                  <div key={g.domain} className="mb-3">
                    <p className="kicker px-3 pb-1 !text-[10.5px]">
                      {tx(DOMAIN_HEADING[g.domain])}
                    </p>
                    <NavItems items={g.items} surface="drawer" signedIn={signedIn} />
                  </div>
                ))}
                <div className="mb-3">
                  <p className="kicker px-3 pb-1 !text-[10.5px]">{tx("About")}</p>
                  <ul>
                    <li>
                      <Link
                        to="/about"
                        className="block rounded-xl px-3 py-2.5 font-body text-[14px] font-semibold text-ink transition-colors hover:bg-paper-dim"
                      >
                        {tx("About Us")}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/contact"
                        className="block rounded-xl px-3 py-2.5 font-body text-[14px] font-semibold text-ink transition-colors hover:bg-paper-dim"
                      >
                        {tx("Contact")}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-ink-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <LanguagePicker code={langCode} onChange={setLanguage} />
                  <ThemeControl />
                </div>
                {user ? (
                  <button
                    onClick={() => {
                      setDrawer(false);
                      logout();
                      navigate({ to: "/" });
                    }}
                    className="btn-ghost w-full !py-2.5 !text-[13px]"
                  >
                    <LogOut size={14} aria-hidden /> {tx("Log out")}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/auth"
                      search={{ mode: "login" }}
                      onClick={() => setDrawer(false)}
                      className="btn-ghost !py-2.5 !text-[13px]"
                    >
                      {tx("Log in")}
                    </Link>
                    <Link
                      to="/auth"
                      search={{ mode: "signup" }}
                      onClick={() => setDrawer(false)}
                      className="btn-primary !py-2.5 !text-[13px]"
                    >
                      {tx("Join free")}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

/**
 * The one-tap flip between the two registers (Dark and Light). The full Light / Dark / System
 * control lives in the menu drawer and in Settings; a flip here makes the choice explicit.
 */
function ModeSwitch({
  mode,
  onToggle,
  className = "",
}: {
  mode: string;
  onToggle: () => void;
  className?: string;
}) {
  const tx = useTx();
  const dark = mode === "genz";
  return (
    <button
      onClick={onToggle}
      aria-pressed={dark}
      title={dark ? tx("Switch to Millennial") : tx("Switch to Gen Z")}
      className={`nav-icon ${className}`.trim()}
    >
      {dark ? (
        <Moon size={15} className="text-saffron-500" aria-hidden />
      ) : (
        <Sun size={15} className="text-saffron-500" aria-hidden />
      )}
      {/* A fixed name; the pressed state says whether Gen Z is on. */}
      <span className="sr-only">{tx("Gen Z theme")}</span>
    </button>
  );
}

/**
 * Language picker: a native select, because it has to work on a low-end
 * phone with a screen reader. Options show the endonym first.
 *
 * In the island (`surface="nav"`) it is a 44px globe below 1500px and shows the language name from
 * there up (evo-nav.css); the select stays the real control either way, so it never loses its name.
 */
function LanguagePicker({
  code,
  onChange,
  surface = "drawer",
}: {
  code: string;
  onChange: (code: string) => void;
  surface?: "nav" | "drawer";
}) {
  const tx = useTx();
  return (
    <label className="nvx-lang relative inline-flex items-center" data-surface={surface}>
      <span className="sr-only">{tx("Language")}</span>
      <Globe
        size={13}
        aria-hidden
        className="nvx-lang-globe pointer-events-none absolute left-3 text-saffron-500"
      />
      <select
        value={code}
        onChange={(e) => onChange(e.target.value)}
        title={`${tx("Language")}: ${languageFor(code).native}`}
        className="appearance-none rounded-full border border-transparent bg-transparent py-2 pl-8 pr-3 font-body text-[12.5px] font-semibold text-ink-soft outline-none transition-colors hover:bg-paper-dim focus-visible:border-saffron-500"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-label={label} className="nav-icon">
      {children}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body text-[14px] font-semibold text-ink transition-colors hover:bg-paper-dim"
    >
      <span className="text-ink-mute">{icon}</span>
      {label}
    </button>
  );
}

/** An avatar-menu entry resolved from the registry (always the member route). */
function MenuLink({ id, onDone }: { id: NavItemId; onDone: () => void }) {
  const labelOf = useNavLabel();
  const href = parseHref(hrefFor(id, true));
  return (
    <Link
      to={href.to}
      search={href.search as never}
      hash={href.hash}
      role="menuitem"
      onClick={onDone}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body text-[14px] font-semibold text-ink transition-colors hover:bg-paper-dim"
    >
      <span className="text-ink-mute">
        <NavIcon id={id} size={15} />
      </span>
      {labelOf(id)}
    </Link>
  );
}
