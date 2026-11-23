/**
 * What the Supabase auth server will actually accept.
 *
 * The sign-in screen used to offer "Continue with Google" unconditionally. If
 * the provider is not switched on for the project, that button fails with a
 * raw "Unsupported provider" — a dead end that looks like the site is broken.
 *
 * GoTrue publishes its own configuration at `/auth/v1/settings`, so the form
 * asks rather than assumes: providers that are off are not offered, and if
 * someone enables Google later it appears without a code change.
 */

import { authBackend, getSupabase } from "./supabase";

export interface AuthSettings {
  /** OAuth providers that are switched on, e.g. ["google"]. */
  providers: string[];
  /** True when new sign-ups are turned off for the project. */
  signupDisabled: boolean;
  /**
   * True when a new account is usable immediately. False means Supabase sends
   * a confirmation link first, and the UI has to say so rather than sitting on
   * a form that looks like it failed.
   */
  autoConfirm: boolean;
}

/** Safe default: email only, confirmation required. */
const FALLBACK: AuthSettings = { providers: [], signupDisabled: false, autoConfirm: false };

let cached: Promise<AuthSettings> | null = null;

export function getAuthSettings(): Promise<AuthSettings> {
  if (cached) return cached;

  // Firebase sign-in: Google is switched on in the Firebase project, and a new account is usable
  // at once (the verification email is sent, but nothing waits for it).
  if (authBackend === "firebase") {
    cached = Promise.resolve({ providers: ["google"], signupDisabled: false, autoConfirm: true });
    return cached;
  }

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || !getSupabase()) return Promise.resolve(FALLBACK);

  cached = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      if (!body || typeof body !== "object") return FALLBACK;
      const b = body as {
        external?: Record<string, boolean>;
        disable_signup?: boolean;
        mailer_autoconfirm?: boolean;
      };
      const external = b.external ?? {};
      return {
        // "email", "phone" and "anonymous_users" are listed alongside the real
        // OAuth providers; they are not buttons.
        providers: Object.keys(external).filter(
          (p) => external[p] === true && p !== "email" && p !== "phone" && p !== "anonymous_users",
        ),
        signupDisabled: b.disable_signup === true,
        autoConfirm: b.mailer_autoconfirm === true,
      };
    })
    .catch(() => FALLBACK);

  return cached;
}
