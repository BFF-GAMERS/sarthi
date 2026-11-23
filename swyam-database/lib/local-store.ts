/**
 * Client-side persistence layer.
 *
 * This project ships without a server database — `AuthContext` already keeps
 * accounts in localStorage, and this module follows the same model so contact
 * submissions and profile edits survive reloads.
 *
 * SWAP POINT: every read/write goes through the functions below. Replacing
 * them with `fetch` calls to a real API (or a Supabase client) is enough to
 * move this data server-side; no component needs to change.
 */

const CONTACT_KEY = "swayam-contact-submissions";
const PROFILE_KEY = "swayam-profiles";
const CITY_KEY = "swayam-city";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — fail quietly rather than breaking the form */
  }
}

/* ── Contact submissions ─────────────────────────────────────────── */

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

function listContactSubmissions(): ContactSubmission[] {
  return read<ContactSubmission[]>(CONTACT_KEY, []);
}

export function saveContactSubmission(
  input: Omit<ContactSubmission, "id" | "createdAt">,
): ContactSubmission {
  const record: ContactSubmission = {
    ...input,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  write(CONTACT_KEY, [record, ...listContactSubmissions()]);
  return record;
}

/* ── User profiles ───────────────────────────────────────────────── */

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  bio: string;
  location: string;
  education: string;
  skills: string[];
  avatar: string;
}

type ProfileMap = Record<string, UserProfile>;

export function getProfile(email: string): UserProfile | null {
  return read<ProfileMap>(PROFILE_KEY, {})[email.toLowerCase()] ?? null;
}

export function saveProfile(email: string, profile: UserProfile): UserProfile {
  const all = read<ProfileMap>(PROFILE_KEY, {});
  all[email.toLowerCase()] = profile;
  write(PROFILE_KEY, all);
  return profile;
}

/* ── Preferred city (drives location-aware ranking) ──────────────── */

export function getPreferredCity(): string | null {
  return read<string | null>(CITY_KEY, null);
}

export function setPreferredCity(city: string | null) {
  write(CITY_KEY, city);
}

/* ── Validation shared by the contact and profile forms ──────────── */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Accepts Indian mobile numbers with optional +91 and common separators. */
export const isPhone = (v: string) => /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""));
