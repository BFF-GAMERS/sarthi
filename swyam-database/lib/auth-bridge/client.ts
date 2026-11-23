/**
 * Firebase login → Supabase session (the browser half of the auth bridge).
 *
 * `authApi` answers in supabase-js shapes (getSession, onAuthStateChange, signInWithPassword…) so
 * the rest of the app keeps calling `supabase.auth.*` as before. Underneath, people sign in with
 * Firebase Authentication, and the session handed out carries a SUPABASE access token, traded for
 * the Firebase ID token at POST /api/auth/exchange (src/lib/auth-bridge/server.ts). The Supabase
 * client is built with `accessToken: supabaseAccessToken`, so every query and RPC runs as the
 * member under the database's own RLS.
 *
 * Switched on by VITE_AUTH_BACKEND=firebase (src/lib/supabase.ts).
 */
import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type Auth,
  type User as FbUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
};

const isBrowser = typeof window !== "undefined";
let fbAuth: Auth | null = null;
function auth(): Auth | null {
  if (!isBrowser || !firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  if (!fbAuth) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>);
    fbAuth = getAuth(app);
    void setPersistence(fbAuth, browserLocalPersistence).catch(() => undefined);
  }
  return fbAuth;
}

/* ───────────── the Supabase session behind a Firebase sign-in ───────────── */

export interface SbUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at: string | null;
  email_confirmed_at: string | null;
}
export interface SbSession {
  user: SbUser;
  access_token: string;
  expires_at: number;
  token_type: "bearer";
}
type AuthErr = { message: string; status: number };

interface Held {
  fbUid: string;
  session: SbSession;
}
let held: Held | null = null;
let inflight: Promise<SbSession> | null = null;
/** Sent once, with the first exchange after sign-up, to name the new member. */
let pendingProfile: { display_name?: string; handle?: string } | null = null;

class ExchangeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The Supabase session for the signed-in Firebase user, renewed a minute before it ends. */
async function sessionFor(u: FbUser, force = false): Promise<SbSession> {
  const now = Date.now() / 1000;
  if (!force && held && held.fbUid === u.uid && held.session.expires_at - 60 > now)
    return held.session;
  inflight ??= (async () => {
    try {
      const idToken = await u.getIdToken(force);
      const res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, ...(pendingProfile ? { profile: pendingProfile } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        access_token?: string;
        expires_at?: number;
        user?: SbUser;
      };
      if (!res.ok || !body.access_token || !body.user)
        throw new ExchangeError(body.error ?? "Could not sign you in right now.", res.status);
      pendingProfile = null;
      const session: SbSession = {
        user: body.user,
        access_token: body.access_token,
        expires_at: body.expires_at ?? now + 3600,
        token_type: "bearer",
      };
      held = { fbUid: u.uid, session };
      return session;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const ready: Promise<void> = new Promise((resolve) => {
  if (!isBrowser) return resolve();
  queueMicrotask(() => {
    const a = auth();
    if (!a) return resolve();
    const off = onAuthStateChanged(a, () => {
      off();
      resolve();
    });
  });
});

async function currentSession(): Promise<SbSession | null> {
  await ready;
  const u = auth()?.currentUser;
  if (!u) return null;
  try {
    return await sessionFor(u);
  } catch {
    return null;
  }
}

/** Handed to createClient({ accessToken }): every request carries the member's Supabase token. */
export async function supabaseAccessToken(): Promise<string | null> {
  return (await currentSession())?.access_token ?? null;
}

/** Firebase's error codes, as the messages supabase-js used, so humanAuthError() still maps them. */
function authError(e: unknown): AuthErr {
  if (e instanceof ExchangeError) return { message: e.message, status: e.status };
  const code = (e as { code?: string }).code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Invalid login credentials",
    "auth/wrong-password": "Invalid login credentials",
    "auth/user-not-found": "Invalid login credentials",
    "auth/invalid-email": "Unable to validate email address: invalid format",
    "auth/email-already-in-use": "User already registered",
    "auth/weak-password": "Password should be at least 6 characters",
    "auth/too-many-requests": "Too many requests",
    "auth/popup-closed-by-user": "Sign-in was cancelled",
    "auth/cancelled-popup-request": "Sign-in was cancelled",
    "auth/popup-blocked":
      "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
    "auth/network-request-failed": "Failed to fetch",
  };
  return { message: map[code] ?? (e as Error).message ?? "Authentication failed", status: 400 };
}

const noSession = (error: AuthErr) => ({ data: { user: null, session: null }, error });

/* ───────────── supabase-js shaped auth API ───────────── */

export const authApi = {
  async getSession() {
    return { data: { session: await currentSession() }, error: null };
  },
  async getUser() {
    const s = await currentSession();
    return s
      ? { data: { user: s.user }, error: null }
      : { data: { user: null }, error: { message: "Auth session missing!", status: 401 } };
  },
  onAuthStateChange(cb: (event: string, session: SbSession | null) => void) {
    const a = auth();
    if (!a) return { data: { subscription: { unsubscribe: () => undefined } } };
    let first = true;
    const off = onAuthStateChanged(a, (u) => {
      const event = first ? "INITIAL_SESSION" : u ? "SIGNED_IN" : "SIGNED_OUT";
      first = false;
      if (!u) {
        held = null;
        cb(event, null);
        return;
      }
      void sessionFor(u)
        .then((s) => cb(event, s))
        .catch(() => cb(event, null));
    });
    return { data: { subscription: { unsubscribe: off } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const a = auth();
    if (!a) return noSession({ message: "Sign-in is not available", status: 503 });
    try {
      const cred = await signInWithEmailAndPassword(a, email, password);
      const session = await sessionFor(cred.user, true);
      return { data: { user: session.user, session }, error: null };
    } catch (e) {
      return noSession(authError(e));
    }
  },
  async signInWithOAuth({
    provider,
    options,
  }: {
    provider: string;
    options?: { redirectTo?: string };
  }) {
    const a = auth();
    if (!a || provider !== "google")
      return {
        data: null,
        error: { message: `${provider} sign-in is not available`, status: 400 },
      };
    try {
      const cred = await signInWithPopup(a, new GoogleAuthProvider());
      await sessionFor(cred.user, true);
      if (options?.redirectTo) window.location.assign(options.redirectTo);
      return { data: { provider, url: options?.redirectTo ?? null }, error: null };
    } catch (e) {
      // Signed in to Firebase but refused by the bridge: do not leave a half sign-in behind.
      if (e instanceof ExchangeError) await signOut(a).catch(() => undefined);
      return { data: null, error: authError(e) };
    }
  },
  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) {
    const a = auth();
    if (!a) return noSession({ message: "Sign-up is not available", status: 503 });
    try {
      const name = String(options?.data?.["display_name"] ?? "").trim();
      const handle = String(options?.data?.["handle"] ?? "").trim();
      pendingProfile = { ...(name ? { display_name: name } : {}), ...(handle ? { handle } : {}) };
      const cred = await createUserWithEmailAndPassword(a, email, password);
      if (name) await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
      const session = await sessionFor(cred.user, true);
      void sendEmailVerification(
        cred.user,
        options?.emailRedirectTo ? { url: options.emailRedirectTo } : undefined,
      ).catch(() => undefined);
      return { data: { user: session.user, session }, error: null };
    } catch (e) {
      pendingProfile = null;
      return noSession(authError(e));
    }
  },
  async resend({
    options,
  }: {
    type: string;
    email: string;
    options?: { emailRedirectTo?: string };
  }) {
    const u = auth()?.currentUser;
    if (!u) return { data: null, error: null };
    try {
      await sendEmailVerification(
        u,
        options?.emailRedirectTo ? { url: options.emailRedirectTo } : undefined,
      );
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: authError(e) };
    }
  },
  /** Firebase sends the reset email and hosts the page that sets the new password. */
  async resetPasswordForEmail(email: string) {
    const a = auth();
    if (!a) return { data: null, error: { message: "Not available", status: 503 } };
    try {
      await sendPasswordResetEmail(a, email, { url: `${window.location.origin}/auth?mode=login` });
      return { data: {}, error: null };
    } catch (e) {
      return { data: null, error: authError(e) };
    }
  },
  async updateUser({
    password,
    data,
  }: {
    password?: string;
    email?: string;
    data?: Record<string, unknown>;
  }) {
    const u = auth()?.currentUser;
    if (!u)
      return { data: { user: null }, error: { message: "Auth session missing!", status: 401 } };
    try {
      if (password) await updatePassword(u, password);
      if (data?.["display_name"])
        await updateProfile(u, { displayName: String(data["display_name"]) });
      return { data: { user: held?.session.user ?? null }, error: null };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/requires-recent-login")
        return {
          data: { user: null },
          error: {
            message: "For safety, sign out and sign in again, then change your password.",
            status: 401,
          },
        };
      return { data: { user: null }, error: authError(e) };
    }
  },
  async signOut() {
    held = null;
    const a = auth();
    if (a) await signOut(a);
    return { error: null };
  },
};
