import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { announce } from "./VoiceGuide";
import { useTx } from "../lib/i18n";
import { EV } from "../evolution/config/ids";
import { NAV_REGISTRY, hrefFor } from "../evolution/config/navigation";
import { useUiState } from "../evolution/react/hooks";
import { track } from "../evolution/runtime/tracker/track";
import type { NavItemId } from "../evolution/types";
import { parseHref } from "./evolution/nav-model";

/**
 * Single-key navigation.
 *
 * Off by default and switched on in Settings, because single-key handlers are
 * exactly what clashes with assistive software — a screen reader in browse
 * mode uses these same letters. Someone who needs that software keeps this
 * off; someone navigating by keyboard alone gets to skip the tab order
 * entirely.
 *
 * Nothing fires while a field has focus, so typing "c" into search stays
 * typing. Modifier combinations are left alone so the browser keeps its own.
 */

interface Shortcut {
  key: string;
  /** A registry destination: label and route come from the central registry. */
  id?: NavItemId;
  /** For the few destinations the registry does not hold (the cart). */
  to?: string;
  label?: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "h", id: "HOME" },
  { key: "c", id: "COURSES" },
  { key: "j", id: "JOBS" },
  { key: "w", id: "SKILLS" },
  { key: "d", id: "DASHBOARD" },
  { key: "p", id: "PASSPORT" },
  { key: "r", id: "REWARDS" },
  { key: "k", to: "/cart", label: "Cart" },
  { key: "m", id: "MESSAGES" },
  { key: "n", id: "NOTIFICATIONS" },
  { key: "u", id: "PROFILE" },
  { key: "s", id: "SETTINGS" },
  { key: "/", id: "SEARCH" },
];

const labelOf = (s: Shortcut) => (s.id ? NAV_REGISTRY[s.id].label : (s.label ?? s.key));

/** True when the keystroke belongs to whatever the person is typing into. */
function isTyping(target: EventTarget | null): boolean {
  // Guarded rather than cast: a keydown can be retargeted at the document,
  // which has no tagName and no closest(), and a throw here would take every
  // shortcut down with it.
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true ||
    el.closest("[role='textbox']") !== null
  );
}

export default function KeyboardShortcuts() {
  const tx = useTx();
  const { prefs } = usePreferences();
  const on = prefs.keyboardShortcuts;
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const { user } = useAuth();
  const { state } = useUiState();
  // Read inside the key handler without re-binding the listener on every change.
  const ctx = useRef({ signedIn: Boolean(user), state });
  ctx.current = { signedIn: Boolean(user), state };

  useEffect(() => {
    if (!on) {
      setHelp(false);
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === "Escape") {
        setHelp(false);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }

      const hit = SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
      if (!hit) return;

      e.preventDefault();
      setHelp(false);
      announce(`${labelOf(hit)}.`);
      if (hit.id) {
        track(EV.NAVIGATION_ITEM_CLICKED, {
          item: hit.id,
          surface: "shortcut",
          state: ctx.current.state,
        });
      }
      const href = parseHref(hit.id ? hrefFor(hit.id, ctx.current.signedIn) : (hit.to ?? "/"));
      void navigate({ to: href.to, search: href.search as never, hash: href.hash });
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on, navigate]);

  if (!on || !help) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tx("Keyboard shortcuts")}
      className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={() => setHelp(false)}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-ink-line bg-paper-light p-6 shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              {tx("Keyboard shortcuts")}
            </h2>
            <p className="mt-1 font-body text-sm text-ink-mute">
              {tx("One key, no modifier. They do nothing while you are typing.")}
            </p>
          </div>
          <button
            onClick={() => setHelp(false)}
            className="btn-ghost !p-2"
            aria-label={tx("Close shortcuts")}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between border-b border-ink-line py-1.5 last:border-0"
            >
              <span className="font-body text-sm text-ink-soft">{labelOf(s)}</span>
              <kbd className="rounded border border-ink-line bg-paper-dim px-1.5 py-0.5 font-mono text-[11px] text-ink">
                {s.key}
              </kbd>
            </li>
          ))}
          <li className="flex items-center justify-between border-b border-ink-line py-1.5 last:border-0">
            <span className="font-body text-sm text-ink-soft">{tx("This list")}</span>
            <kbd className="rounded border border-ink-line bg-paper-dim px-1.5 py-0.5 font-mono text-[11px] text-ink">
              ?
            </kbd>
          </li>
        </ul>

        <p className="mt-5 border-t border-ink-line pt-4 font-body text-[12px] text-ink-mute">
          {tx("Turn these off in")} <strong className="text-ink">{tx("Settings")}</strong>{" "}
          {tx("if they clash with a screen reader \u2014 its browse mode uses the same letters.")}
        </p>
      </div>
    </div>
  );
}
