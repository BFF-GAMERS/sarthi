import { useCallback, useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { usePreferences } from "../context/PreferencesContext";
import { speakBest, stopAllSpeech } from "../lib/voice";

/**
 * Spoken navigation.
 *
 * A screen reader is the right tool for someone who has one. Many of the
 * people this platform is built for do not: they are on a shared or low-end
 * Android phone, TalkBack has never been switched on, and nobody has shown
 * them how. This gives the site its own voice instead — opt-in from Settings,
 * speaking whatever the keyboard or a tap lands on, in the language they
 * chose, through Sarvam's Indian-language voices when configured.
 *
 * It is deliberately quiet about detail. Announcing every div would be
 * unusable, so it speaks three things: the page you arrived on, the control
 * you are on now, and anything the app explicitly announces via
 * `announce()`.
 */

/** Fired by the app when something worth saying happens. */
export const ANNOUNCE_EVENT = "swayam:announce";

/**
 * Say something out loud, if the member has spoken navigation switched on.
 *
 * Anything user-visible and important — a swap request sent, a course
 * enrolled — should call this so the spoken experience keeps pace with the
 * visual one.
 */
export function announce(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail: message }));
}

/** A readable name for a focused element, in the order a person would say it. */
function describe(el: Element): string {
  const node = el as HTMLElement;

  const aria = node.getAttribute("aria-label");
  const role =
    node.getAttribute("role") ??
    (node.tagName === "A"
      ? "link"
      : node.tagName === "BUTTON"
        ? "button"
        : node.tagName === "INPUT"
          ? (node as HTMLInputElement).type
          : node.tagName === "SELECT"
            ? "dropdown"
            : node.tagName === "TEXTAREA"
              ? "text area"
              : "");

  let label = aria ?? "";
  if (!label && node.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
    label = forLabel?.textContent?.trim() ?? "";
  }
  if (!label) label = node.closest("label")?.textContent?.trim() ?? "";
  if (!label) label = node.textContent?.trim() ?? "";
  if (!label) label = (node as HTMLInputElement).placeholder ?? "";

  label = label.replace(/\s+/g, " ").slice(0, 140);
  if (!label) return "";

  const state: string[] = [];
  const pressed = node.getAttribute("aria-pressed");
  if (pressed === "true") state.push("selected");
  const expanded = node.getAttribute("aria-expanded");
  if (expanded === "true") state.push("open");
  if ((node as HTMLButtonElement).disabled) state.push("unavailable");

  return [label, role, ...state].filter(Boolean).join(", ");
}

export default function VoiceGuide() {
  const { prefs } = usePreferences();
  const on = prefs.voiceNavigation;
  const locale = prefs.locale;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const lastSpoken = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Speak, but never twice in a row and never on top of itself.
   *
   * Focus can move several times in a few milliseconds as a page settles, so
   * this waits briefly and says only where the focus came to rest.
   */
  const say = useCallback(
    (text: string, delay = 120) => {
      if (!text || text === lastSpoken.current) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastSpoken.current = text;
        void speakBest(text, locale);
      }, delay);
    },
    [locale],
  );

  // Announce each page on arrival.
  useEffect(() => {
    if (!on) return;
    const id = window.setTimeout(() => {
      const heading = document.querySelector("main h1")?.textContent?.trim();
      const title = document.title.split("—")[0]?.trim();
      say(`${heading || title || "Page"} page loaded.`, 0);
    }, 350);
    return () => window.clearTimeout(id);
  }, [on, pathname, say]);

  // Speak whatever the keyboard or a tap lands on.
  useEffect(() => {
    if (!on) return;

    const onFocus = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (el && el !== document.body) say(describe(el));
    };
    // Pointer users get the same feedback without needing to focus first.
    const onPointer = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest(
        "a, button, [role='button'], input, select, textarea",
      );
      if (el) say(describe(el), 240);
    };

    document.addEventListener("focusin", onFocus);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [on, say]);

  // Explicit announcements from the app.
  useEffect(() => {
    if (!on) return;
    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") say(detail, 0);
    };
    window.addEventListener(ANNOUNCE_EVENT, onAnnounce);
    return () => window.removeEventListener(ANNOUNCE_EVENT, onAnnounce);
  }, [on, say]);

  // Escape stops the voice — the single most important control when a page
  // starts reading something long and you want it to stop now.
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAllSpeech();
        lastSpoken.current = "";
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on]);

  useEffect(() => {
    if (on) return;
    // Switched off mid-sentence: stop talking immediately.
    stopAllSpeech();
    clearTimeout(timer.current);
  }, [on]);

  return null;
}
