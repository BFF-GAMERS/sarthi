import { getSupabase } from "./supabase";

/**
 * Usernames.
 *
 * Every account has always had one — the `handle` column, unique, and shown
 * on the Skill Passport and beside a name in Messages. Nobody had ever been
 * asked what it should be. It was derived from the left half of the email
 * address, so a person signing up as `rajesh.k.2004@gmail.com` was introduced
 * to their swap partners as `rajeshk2004`.
 *
 * The rule below is the database's own CHECK constraint, copied exactly. A
 * form that allows something the column refuses is worse than no validation:
 * it takes the answer, then fails on save with a Postgres error string.
 */

export const USERNAME_RULE = /^[a-z0-9_]{3,30}$/;

export const USERNAME_HINT = "3–30 characters: lowercase letters, numbers and underscores.";

/** What the field should contain as the member types — never a rejection. */
export function normaliseUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

/** A suggestion to prefill from, when all we know is their name or email. */
export function suggestUsername(nameOrEmail: string): string {
  const base = normaliseUsername(nameOrEmail.split("@")[0] ?? "");
  return base.length >= 3 ? base : "";
}

export type UsernameState = "empty" | "invalid" | "checking" | "free" | "taken" | "unknown";

/**
 * Asks the database, not the public profiles table.
 *
 * `profiles_select_public` hides private profiles from everyone but their
 * owner, so counting rows from the browser would report a private member's
 * username as free — right up until the unique index refused the insert. The
 * `handle_available` function is SECURITY DEFINER for exactly that reason and
 * returns one boolean, never the row.
 */
export async function isUsernameFree(handle: string): Promise<boolean | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("handle_available", { p_handle: handle });
  if (error) return null; // Offline or blocked — let the save be the judge.
  return data === true;
}
