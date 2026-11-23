import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useTx } from "../lib/i18n";

/**
 * Sarvam's Samvaad call widget.
 *
 * A custom element from Sarvam's own CDN bundle, not something we render: the
 * script defines `<sarvam-widget>` and everything inside it — the button, the
 * microphone permission prompt, the live call — belongs to them.
 *
 * The script is injected once per page load rather than sitting in the
 * document head, so a visitor who never opens the chat or the contact page
 * never downloads it.
 *
 * On the key: this widget takes its credential as a plain attribute, which
 * means it reaches the browser. That is how Sarvam's embed is designed to
 * work, but it does put a Samvaad key in front of anyone who views source, so
 * it is read from `VITE_SARVAM_WIDGET_KEY` rather than written into the
 * repository, and it should be a key scoped to this widget alone.
 */

const SCRIPT_SRC = "https://unpkg.com/sarvam-convai-embed";

/** Loaded once, and shared by every instance on the page. */
let scriptPromise: Promise<void> | null = null;

function loadWidget(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Sarvam's call widget could not be loaded."));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

interface Config {
  apiKey: string;
  appId: string;
  orgId: string;
  workspaceId: string;
}

function config(): Config | null {
  const env = import.meta.env;
  const apiKey = env["VITE_SARVAM_WIDGET_KEY"] as string | undefined;
  const appId = env["VITE_SARVAM_APP_ID"] as string | undefined;
  const orgId = env["VITE_SARVAM_ORG_ID"] as string | undefined;
  const workspaceId = env["VITE_SARVAM_WORKSPACE_ID"] as string | undefined;

  // Off until switched on. A rejected key does not fail quietly: Sarvam's widget
  // puts the raw 401 JSON in front of the visitor, and nothing here can catch it.
  // So having a key is not enough; set VITE_SARVAM_WIDGET_ENABLED=true once a call
  // has been tested with it.
  if (env["VITE_SARVAM_WIDGET_ENABLED"] !== "true") return null;

  // All four or none: a half-configured widget renders a button that fails
  // the moment somebody presses it.
  if (!apiKey || !appId || !orgId || !workspaceId) return null;
  return { apiKey, appId, orgId, workspaceId };
}

export const isWidgetConfigured = (): boolean => config() !== null;

export default function SarvamCall({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const tx = useTx();
  const cfg = config();
  const { profileId } = useAuth();
  const { prefs } = usePreferences();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cfg) return;
    let live = true;
    loadWidget()
      .then(() => live && setState("ready"))
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [cfg]);

  /*
   * Name the widget's own button.
   *
   * The widget renders a 56px black circle with an icon in it and no text,
   * so a screen reader announces "button" and nothing else — axe rates that
   * critical, and it is: the control that starts a phone call is the last
   * place to leave unlabelled. We pass `button-text`, the widget does not
   * use it for the launcher, and its internals are not ours to edit. So we
   * label it from outside once it appears, and only if it is still unnamed —
   * if a future version of the widget names its own button, this does
   * nothing.
   */
  useEffect(() => {
    if (state !== "ready") return;
    const name = label ?? "Begin call";
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const el = host.current?.querySelector("sarvam-widget") as HTMLElement | null;
      const btn = (el?.shadowRoot?.querySelector("button") ??
        el?.querySelector("button")) as HTMLButtonElement | null;
      if (btn) {
        if (!btn.textContent?.trim() && !btn.getAttribute("aria-label")) {
          btn.setAttribute("aria-label", name);
        }
        window.clearInterval(timer);
      } else if (tries > 40) {
        window.clearInterval(timer);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [state, label]);

  // Nothing configured: render nothing rather than a control that cannot work.
  if (!cfg) return null;

  if (state === "failed") {
    return (
      <p className={`font-body text-[12px] text-ink-mute ${className}`} role="status">
        {tx("The call widget could not load. Check your connection and reload.")}
      </p>
    );
  }

  return (
    <div ref={host} className={className}>
      {state === "loading" ? (
        /*
         * Only the widget's script is loading here; no call is being prepared
         * yet. A "Preparing the call\u2026" line at this point read as page content
         * (and stayed on screen whenever the CDN was slow), so nothing visible
         * is shown until the call button itself can appear.
         */
        <span className="sr-only" role="status">
          {tx("Loading the call button")}
        </span>
      ) : (
        /*
         * A custom element, so the props are HTML attributes — hyphenated and
         * all strings. React 19 passes unknown attributes through to the DOM
         * unchanged, which is exactly what the widget reads.
         */
        <sarvam-widget
          api-key={cfg.apiKey}
          app-id={cfg.appId}
          org-id={cfg.orgId}
          workspace-id={cfg.workspaceId}
          // Ties the transcript to the member when there is one, so a call can
          // be traced back in Sarvam's console.
          user-id={profileId ?? "guest"}
          button-text={label ?? "Begin call"}
          interaction-type="call"
          language={prefs.locale}
        />
      )}
    </div>
  );
}
