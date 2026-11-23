import { getItem, setItem, removeItem } from "./store";
import { logEvent } from "./activity";

/*
 * SECURITY NOTE — read before relying on this module.
 *
 * Swyam is an OFFLINE app with no backend. Accounts and sessions live in
 * localStorage on this device. This is a LOCAL DEVICE GATE: it keeps casual
 * users out of pages and separates profiles on a shared device. It is NOT
 * secure server-side authentication. Anyone with access to the browser's
 * storage can read accounts, hashes and sessions, and can edit them.
 * Class-level and role-based pages are all client-side.
 */

export type Role = "student" | "teacher" | "volunteer" | "parent" | "admin";
export type Language = "en" | "hi" | "hinglish";
export type ClassLevel = 8 | 9 | 10 | 11 | 12;

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  board?: "CBSE";
  classLevel?: ClassLevel;
  subjects?: string[];
  language: Language;
  createdAt: string;
  /** undefined means approved (accounts created before approvals existed). */
  status?: "pending" | "approved";
}

export interface Session {
  accountId: string;
  role: Role;
}

type Result = { ok: true; account: Account } | { ok: false; error: string };

/** SHA-256 hex digest of the password. local-device hashing only, not server-grade. */
export async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode(pw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function listAccounts(): Account[] {
  return getItem<Account[]>("accounts", []);
}

function saveAccounts(accounts: Account[]): void {
  setItem("accounts", accounts);
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function actorEmail(): string {
  return currentAccount()?.email ?? "system";
}

const ADMIN_SEED = {
  name: "Aarush Mehta",
  email: "aarushmehta024@gmail.com",
  password: "123456789",
  role: "admin" as const,
};

/** Creates the built-in admin account on this device if it does not exist yet. */
export async function ensureAdminSeed(): Promise<void> {
  const email = normaliseEmail(ADMIN_SEED.email);
  const accounts = listAccounts();
  const existing = accounts.find((a) => normaliseEmail(a.email) === email);
  if (existing) {
    if (existing.role !== "admin") {
      saveAccounts(accounts.map((a) => (a === existing ? { ...a, role: "admin" } : a)));
    }
    const session = getItem<Session | null>("session", null);
    if (session && session.accountId === existing.id && session.role !== "admin") {
      setItem<Session>("session", { accountId: existing.id, role: "admin" });
    }
    return;
  }
  const account: Account = {
    id: newId(),
    name: ADMIN_SEED.name,
    email,
    role: ADMIN_SEED.role,
    passwordHash: await hashPassword(ADMIN_SEED.password),
    language: "hinglish",
    createdAt: new Date().toISOString(),
  };
  saveAccounts([...listAccounts(), account]);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  classLevel?: ClassLevel;
  subjects?: string[];
  language: Language;
}): Promise<Result> {
  if (input.role === "admin") {
    return { ok: false, error: "Admin accounts cannot be created here." };
  }
  const name = input.name.trim();
  const email = normaliseEmail(input.email);

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!email.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const accounts = listAccounts();
  if (accounts.some((a) => normaliseEmail(a.email) === email)) {
    return { ok: false, error: "An account with this email already exists on this device." };
  }

  const subjects = (input.subjects ?? []).map((s) => s.trim()).filter(Boolean);
  const account: Account = {
    id: newId(),
    name,
    email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    language: input.language,
    createdAt: new Date().toISOString(),
  };

  if (input.role === "student") {
    if (!input.classLevel || ![8, 9, 10, 11, 12].includes(input.classLevel)) {
      return { ok: false, error: "Please choose your class (8 to 12)." };
    }
    account.board = "CBSE";
    account.classLevel = input.classLevel;
  }
  // teacher, volunteer and parent accounts get no extra fields: role
  // verification is not possible offline.
  if (subjects.length > 0) account.subjects = subjects;

  // teacher and volunteer accounts need admin approval before they can log in.
  if (input.role === "teacher" || input.role === "volunteer") account.status = "pending";

  saveAccounts([...accounts, account]);
  if (account.status !== "pending") {
    setItem<Session>("session", { accountId: account.id, role: account.role });
  }
  logEvent({ type: "account_created", actor: account.email, target: account.email, detail: account.role });
  return { ok: true, account };
}

export async function login(email: string, password: string, role: Role): Promise<Result> {
  await ensureAdminSeed();
  const hash = await hashPassword(password);
  const wanted = normaliseEmail(email);
  const account = listAccounts().find(
    (a) => normaliseEmail(a.email) === wanted && a.role === role && a.passwordHash === hash,
  );
  if (!account) return { ok: false, error: "Email, password or role is incorrect." };
  if (account.status === "pending") {
    return { ok: false, error: "Aapka account admin approval ka intezaar kar raha hai." };
  }

  setItem<Session>("session", { accountId: account.id, role: account.role });
  logEvent({ type: "login", actor: account.email, target: account.email });
  return { ok: true, account };
}

export function getSession(): Session | null {
  return getItem<Session | null>("session", null);
}

export function logout(): void {
  removeItem("session");
}

export function currentAccount(): Account | null {
  const session = getSession();
  if (!session) return null;
  return listAccounts().find((a) => a.id === session.accountId) ?? null;
}

export function deleteAccount(id: string): { ok: boolean; error?: string } {
  const accounts = listAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return { ok: false, error: "Account not found." };
  const adminCount = accounts.filter((a) => a.role === "admin").length;
  if (target.role === "admin" && adminCount <= 1) {
    return { ok: false, error: "Cannot delete the last admin account." };
  }
  saveAccounts(accounts.filter((a) => a.id !== id));
  logEvent({ type: "account_deleted", actor: actorEmail(), target: target.email });
  if (getSession()?.accountId === id) removeItem("session");
  return { ok: true };
}

export async function resetPassword(id: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const passwordHash = await hashPassword(newPassword);
  const accounts = listAccounts();
  if (!accounts.some((a) => a.id === id)) return { ok: false, error: "Account not found." };
  const target = accounts.find((a) => a.id === id);
  saveAccounts(accounts.map((a) => (a.id === id ? { ...a, passwordHash } : a)));
  if (target) logEvent({ type: "password_reset", actor: actorEmail(), target: target.email });
  return { ok: true };
}

export function updateAccount(id: string, patch: { name?: string; role?: Role }): { ok: boolean; error?: string } {
  const accounts = listAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return { ok: false, error: "Account not found." };

  const name = patch.name !== undefined ? patch.name.trim() : target.name;
  if (!name) return { ok: false, error: "Please enter a name." };
  const role: Role = patch.role ?? target.role;

  const adminCount = accounts.filter((a) => a.role === "admin").length;
  if (target.role === "admin" && role !== "admin" && adminCount <= 1) {
    return { ok: false, error: "Cannot demote the last admin account." };
  }

  saveAccounts(accounts.map((a) => (a.id === id ? { ...a, name, role } : a)));
  const session = getSession();
  if (session?.accountId === id) setItem<Session>("session", { accountId: id, role });
  if (role !== target.role) {
    logEvent({ type: "role_change", actor: actorEmail(), target: target.email, detail: `${target.role} -> ${role}` });
  }
  if (name !== target.name) {
    logEvent({ type: "account_updated", actor: actorEmail(), target: target.email, detail: `name: ${target.name} -> ${name}` });
  }
  return { ok: true };
}

/** Marks a pending teacher/volunteer account as approved so it can log in. */
export function approveAccount(id: string): { ok: boolean; error?: string } {
  const accounts = listAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return { ok: false, error: "Account not found." };
  saveAccounts(accounts.map((a) => (a.id === id ? { ...a, status: "approved" } : a)));
  logEvent({ type: "approval", actor: actorEmail(), target: target.email, detail: target.role });
  return { ok: true };
}
