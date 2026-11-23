import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "../data/mock";
import { initialsAvatar } from "../lib/avatar";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * The single authentication system for the whole product.
 *
 * One account signs a person into Swayam, SkillSwap, courses, jobs, the
 * passport and Sarthi — there is deliberately no second login anywhere.
 *
 * Backed by Supabase Auth when the project is configured. The `handle_new_user`
 * trigger creates the matching `profiles`, `profile_privacy`, `user_preferences`
 * and `user_roles` rows on sign-up, so a session always implies a profile.
 *
 * When no credentials are present (a fresh checkout with no `.env`) this falls
 * back to the original localStorage accounts, so the app stays explorable
 * offline instead of erroring at the sign-in screen. `isRemote` tells callers
 * which mode they are in; anything that writes to Supabase should check it.
 */

export interface User {
  email: string;
  name: string;
  role: Role;
  avatar: string;
}

interface AuthContextShape {
  user: User | null;
  /**
   * `profiles.id` for the signed-in person — the key every SkillSwap table is
   * foreign-keyed to. Equals the auth user id. Null when signed out, or when
   * running on the localStorage fallback.
   */
  profileId: string | null;
  /** False until the stored session has been checked, so guards don't flash. */
  ready: boolean;
  /** True when a real Supabase project is backing this session. */
  isRemote: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  /**
   * Create an account.
   *
   * Resolves with `needsConfirmation: true` when the project requires the
   * email to be verified first. That is a success, not a failure — throwing
   * for it made a completed sign-up render as a red error.
   */
  signup: (
    name: string,
    email: string,
    password: string,
    role: Role,
    /** The username they chose. Falls back to one derived from the email. */
    handle?: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  forgotPassword: (email: string) => Promise<void>;
  /**
   * True while the browser is holding a session that came from a recovery
   * link rather than a login.
   *
   * Supabase signs the person in to prove they hold the mailbox, which is
   * exactly why this flag exists: without it, "reset my password" silently
   * becomes "log me in" and the password is never actually changed.
   */
  recovery: boolean;
  /** Write a new password for the signed-in account. */
  setPassword: (password: string) => Promise<void>;
  /** Send the confirmation link again, for when the first one never arrived. */
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => void;
  /**
   * The dashboards this account is entitled to.
   *
   * The switcher used to offer all three to everybody, so a student could
   * open the recruiter and institute views. `claim_self_role` refuses the
   * privileged database roles, but the switcher set the local role anyway and
   * the other dashboard rendered regardless of what the server said.
   */
  availableRoles: Role[];
  setRole: (role: Role) => void;
  /** Merge profile edits into the session and the stored account. */
  updateUser: (patch: Partial<Pick<User, "name" | "avatar" | "email">>) => void;
}

const AuthContext = createContext<AuthContextShape | null>(null);

const USERS_KEY = "sih-users";
const SESSION_KEY = "sih-session";
/** Role chosen at sign-up, claimed once the confirmed account first signs in. */
const PENDING_ROLE_KEY = "swayam-pending-role";

interface StoredUser extends User {
  password: string;
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * UI role -> database role.
 *
 * `claim_self_role` deliberately refuses `company_member`, `moderator` and
 * `admin`: those confer power over other people's records and are granted by
 * a company owner or an administrator, never claimed at sign-up. A recruiter
 * therefore starts as `professional` and is upgraded by their company; an
 * institute starts as `course_creator`, which is what it needs to publish.
 */
const DB_ROLE: Record<Role, "student" | "professional" | "course_creator"> = {
  student: "student",
  recruiter: "professional",
  institute: "course_creator",
};

/** Database role -> the role the existing UI knows how to render. */
function uiRole(roles: string[]): Role {
  if (roles.includes("course_creator")) return "institute";
  if (roles.includes("company_member") || roles.includes("professional")) return "recruiter";
  return "student";
}

/**
 * Every dashboard this set of database roles entitles the account to.
 *
 * Student is unconditional — everyone is a learner here, and it is the role
 * sign-up grants. The other two have to be held.
 */
function uiRoles(roles: string[]): Role[] {
  const out: Role[] = ["student"];
  if (roles.includes("company_member") || roles.includes("professional")) out.push("recruiter");
  if (roles.includes("course_creator")) out.push("institute");
  return out;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Role[]>(["student"]);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const supabase = getSupabase();
  const isRemote = isSupabaseConfigured;

  /**
   * Build the session user from the profile row rather than auth metadata:
   * the profile is what the rest of the app reads and edits, so a rename on
   * the profile page shows up in the navbar without a re-login.
   */
  const hydrate = useCallback(
    async (session: Session | null) => {
      if (!supabase || !session?.user) {
        setUser(null);
        setProfileId(null);
        return;
      }

      const authUser = session.user;

      // A role chosen at sign-up can only be claimed once the confirmed
      // account actually has a session, which is this moment.
      try {
        const pending = localStorage.getItem(PENDING_ROLE_KEY) as Role | null;
        if (pending && pending !== "student" && DB_ROLE[pending]) {
          await supabase.rpc("claim_self_role", { p_role: DB_ROLE[pending] });
        }
        if (pending) localStorage.removeItem(PENDING_ROLE_KEY);
      } catch {
        /* the account is still usable as a student */
      }

      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("profile_id", authUser.id),
      ]);

      const name =
        profile?.display_name ||
        (authUser.user_metadata?.["display_name"] as string | undefined) ||
        authUser.email?.split("@")[0] ||
        "Member";

      const dbRoles = (roleRows ?? []).map((r) => r.role as string);
      setProfileId(authUser.id);
      setAvailableRoles(uiRoles(dbRoles));
      setUser({
        email: authUser.email ?? "",
        name,
        role: uiRole(dbRoles),
        avatar: profile?.avatar_url || initialsAvatar(name),
      });
    },
    [supabase],
  );

  // Restore the session after hydration so SSR and client markup match.
  useEffect(() => {
    let cancelled = false;

    if (!supabase) {
      // Offline fallback: the original localStorage session.
      try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch {
        /* ignore */
      }
      setReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      void hydrate(data.session).finally(() => {
        if (!cancelled) setReady(true);
      });
    });

    // Keeps every tab in step, and picks up the OAuth redirect on return.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      // The recovery link's session is real, but it means "prove it is you",
      // not "you are logged in and done".
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      void hydrate(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, hydrate]);

  useEffect(() => {
    if (supabase) return;
    // Seed a demo account so the offline build is explorable without signing up.
    const users = readUsers();
    if (!users.some((x) => x.email === "demo@skillindia.in")) {
      users.push({
        email: "demo@skillindia.in",
        password: "demo1234",
        name: "Aarav Sharma",
        role: "student",
        avatar: initialsAvatar("Aarav Sharma"),
      });
      writeUsers(users);
    }
  }, [supabase]);

  const persistLocal = (u: User, remember: boolean) => {
    setUser(u);
    const raw = JSON.stringify(u);
    if (remember) {
      localStorage.setItem(SESSION_KEY, raw);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, raw);
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const login = async (email: string, password: string, remember: boolean) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(humanAuthError(error.message));
      await hydrate(data.session);
      return;
    }

    await new Promise((r) => setTimeout(r, 600));
    const found = readUsers().find((x) => x.email === email.toLowerCase().trim());
    if (!found || found.password !== password) {
      throw new Error("Invalid email or password. Try demo@skillindia.in / demo1234");
    }
    const { password: _pw, ...safe } = found;
    persistLocal(safe, remember);
  };

  const loginWithGoogle = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      // On success the browser navigates away; onAuthStateChange picks the
      // session up when it comes back.
      if (error) throw new Error(humanAuthError(error.message));
      return;
    }

    await new Promise((r) => setTimeout(r, 900));
    persistLocal(
      {
        email: "aarav.sharma@gmail.com",
        name: "Aarav Sharma",
        role: "student",
        avatar: initialsAvatar("Aarav Sharma"),
      },
      true,
    );
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    role: Role,
    handle?: string,
  ): Promise<{ needsConfirmation: boolean }> => {
    if (supabase) {
      const clean = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: clean,
        password,
        options: {
          // Read by the handle_new_user trigger to name the profile. The
          // handle is a request, not a reservation: if someone claims it in
          // the seconds between the form's check and this insert, the trigger
          // appends a digit rather than failing the whole sign-up. Settings
          // is where that can be corrected.
          data: {
            display_name: name.trim(),
            ...(handle?.trim() ? { handle: handle.trim().toLowerCase() } : {}),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw new Error(humanAuthError(error.message));

      // With email confirmation switched on there is no session yet. Remember
      // the requested role so it can be claimed on first sign-in instead.
      if (!data.session) {
        try {
          localStorage.setItem(PENDING_ROLE_KEY, role);
        } catch {
          /* private mode — the role just defaults to student */
        }
        return { needsConfirmation: true };
      }
      if (role !== "student") {
        await supabase.rpc("claim_self_role", { p_role: DB_ROLE[role] });
      }
      await hydrate(data.session);
      return { needsConfirmation: false };
    }

    await new Promise((r) => setTimeout(r, 600));
    const users = readUsers();
    const clean = email.toLowerCase().trim();
    if (users.some((x) => x.email === clean)) {
      throw new Error("An account with this email already exists. Try logging in.");
    }
    const stored: StoredUser = {
      email: clean,
      password,
      name: name.trim(),
      role,
      avatar: initialsAvatar(name.trim()),
    };
    users.push(stored);
    writeUsers(users);
    const { password: _pw, ...safe } = stored;
    persistLocal(safe, true);
    return { needsConfirmation: false };
  };

  const resendConfirmation = async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw new Error(humanAuthError(error.message));
  };

  const forgotPassword = async (email: string) => {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        // Land on the form that actually sets a new password, not on login.
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw new Error(humanAuthError(error.message));
      return;
    }

    await new Promise((r) => setTimeout(r, 800));
    if (!readUsers().some((x) => x.email === email.toLowerCase().trim())) {
      throw new Error("No account found with this email.");
    }
  };

  /**
   * Change the password on the account this session belongs to.
   *
   * Supabase writes it against the current session, so this works both for
   * someone who arrived from a recovery link and for someone changing it
   * while already signed in.
   */
  const setPassword = async (password: string) => {
    if (!supabase) throw new Error("Password changes need the live backend.");
    if (password.length < 8) throw new Error("Use at least 8 characters.");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(humanAuthError(error.message));
    setRecovery(false);
  };

  const logout = () => {
    setUser(null);
    setProfileId(null);
    if (supabase) {
      void supabase.auth.signOut();
      return;
    }
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const updateUser = (patch: Partial<Pick<User, "name" | "avatar" | "email">>) => {
    if (!user) return;
    const updated = { ...user, ...patch };
    setUser(updated);

    if (supabase && profileId) {
      // Email lives in auth, not the profile, so only profile fields go here.
      const profilePatch: { display_name?: string; avatar_url?: string } = {};
      if (patch.name !== undefined) profilePatch.display_name = patch.name;
      if (patch.avatar !== undefined) profilePatch.avatar_url = patch.avatar;
      if (Object.keys(profilePatch).length > 0) {
        void supabase.from("profiles").update(profilePatch).eq("id", profileId);
      }
      return;
    }

    // Mirror the change onto the stored account record.
    const users = readUsers();
    const i = users.findIndex((x) => x.email === user.email);
    if (i >= 0) {
      users[i] = { ...users[i]!, ...patch };
      writeUsers(users);
    }
    const raw = JSON.stringify(updated);
    if (localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, raw);
    else sessionStorage.setItem(SESSION_KEY, raw);
  };

  const setRole = (role: Role) => {
    if (!user) return;
    setUser({ ...user, role });

    if (supabase && profileId) {
      void supabase.rpc("claim_self_role", { p_role: DB_ROLE[role] });
      return;
    }

    const raw = JSON.stringify({ ...user, role });
    if (localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, raw);
    else sessionStorage.setItem(SESSION_KEY, raw);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profileId,
        ready,
        isRemote,
        login,
        loginWithGoogle,
        signup,
        forgotPassword,
        recovery,
        setPassword,
        resendConfirmation,
        logout,
        availableRoles,
        setRole,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Supabase returns terse, lowercase auth errors. Rewrite the few a person is
 * actually likely to hit; pass anything else through so real faults stay
 * visible rather than being flattened into a generic message.
 */
function humanAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account. Check both, or create one.";
  }
  if (/user already registered/i.test(message)) {
    return "An account with this email already exists. Try logging in.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirm your email first — check your inbox for the link we sent.";
  }
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return "That sign-in method isn't enabled for this project. Use your email and password.";
  }
  if (/password should be at least|weak password/i.test(message)) {
    return "Pick a longer password — at least 8 characters.";
  }
  if (/rate limit|too many requests|after \d+ seconds/i.test(message)) {
    // Supabase usually says exactly how long is left. Passing that number
    // through beats a vague "wait a minute" — the limit is enforced by the
    // auth server's email quota, so there is nothing this client can do but
    // report the wait accurately.
    // Deliberately says nothing about *which* email: this branch is shared by
    // sign-up, log-in and password reset, and naming one of them produces a
    // message about resets while somebody is creating an account.
    const seconds = /after (\d+) seconds?/i.exec(message)?.[1];
    if (seconds) {
      // A short per-request throttle. The server named the wait, so quote it.
      return `Too many attempts in a row. Try again in ${seconds} second${
        seconds === "1" ? "" : "s"
      }.`;
    }
    // No number means the *hourly* mail quota rather than the short throttle —
    // the built-in mailer allows only a couple of messages an hour. Saying
    // "try again in a minute" sends people straight back into the same wall,
    // and because the quota is checked before the account is written, a
    // sign-up that trips it created nothing. Both facts belong in the message.
    return "The confirmation email could not be sent — this site's hourly email limit is used up. No account was created, so nothing is half-finished. Try again in an hour.";
  }
  if (/signups? (not allowed|are disabled)/i.test(message)) {
    return "New sign-ups are turned off for this project right now.";
  }
  if (/unable to validate email|invalid format/i.test(message)) {
    return "That email address doesn't look right.";
  }
  return message;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
