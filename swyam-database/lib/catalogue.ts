/**
 * Catalogue actions — enrolling and applying for real.
 *
 * The listing and detail pages render their copy from `src/data/`, which keeps
 * the catalogue fast and readable offline. The *records* those pages describe
 * also exist in Postgres, keyed by the same id (stored as `slug`), so pressing
 * Enrol or Apply writes a real row that the dashboard, profile and passport
 * then read back.
 *
 * That split is deliberate: one identity per item, one place for its prose.
 */

import { getSupabase, requireSupabase } from "./supabase";

/** Cache of slug -> uuid, so a page doesn't re-resolve on every render. */
const courseIds = new Map<string, string>();
const opportunityIds = new Map<string, string>();

async function resolveId(
  table: "courses" | "opportunities",
  slug: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const hit = cache.get(slug);
  if (hit) return hit;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from(table).select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  cache.set(slug, data.id);
  return data.id;
}

export const resolveCourseId = (slug: string) => resolveId("courses", slug, courseIds);
export const resolveOpportunityId = (slug: string) =>
  resolveId("opportunities", slug, opportunityIds);

/* ── Enrolment ───────────────────────────────────────────────────── */

export interface EnrollmentState {
  enrolled: boolean;
  state: string | null;
  progressPercent: number;
}

export async function getEnrollment(
  profileId: string,
  courseSlug: string,
): Promise<EnrollmentState> {
  const supabase = getSupabase();
  const id = await resolveCourseId(courseSlug);
  if (!supabase || !id) return { enrolled: false, state: null, progressPercent: 0 };

  const { data, error } = await supabase
    .from("course_enrollments")
    .select("state, progress_percent")
    .eq("profile_id", profileId)
    .eq("course_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { enrolled: false, state: null, progressPercent: 0 };

  return {
    enrolled: data.state !== "cancelled",
    state: data.state,
    progressPercent: Number(data.progress_percent ?? 0),
  };
}

/**
 * Enrol the member on a course.
 *
 * Idempotent: enrolling twice re-activates the existing row rather than
 * failing on the unique constraint, which is what someone who cancelled and
 * came back expects.
 */
export async function enrollInCourse(profileId: string, courseSlug: string): Promise<void> {
  const supabase = requireSupabase();
  const id = await resolveCourseId(courseSlug);
  if (!id) throw new Error("That course isn't in the catalog yet.");

  const { error } = await supabase
    .from("course_enrollments")
    .upsert(
      { profile_id: profileId, course_id: id, state: "active" },
      { onConflict: "course_id,profile_id" },
    );
  if (error) throw new Error(error.message);
}

/* ── Applications ────────────────────────────────────────────────── */

export interface ApplicationState {
  applied: boolean;
  state: string | null;
  submittedAt: string | null;
}

export async function getApplication(
  profileId: string,
  opportunitySlug: string,
): Promise<ApplicationState> {
  const supabase = getSupabase();
  const id = await resolveOpportunityId(opportunitySlug);
  if (!supabase || !id) return { applied: false, state: null, submittedAt: null };

  const { data, error } = await supabase
    .from("applications")
    .select("state, submitted_at")
    .eq("profile_id", profileId)
    .eq("opportunity_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { applied: false, state: null, submittedAt: null };

  return {
    applied: data.state !== "withdrawn",
    state: data.state,
    submittedAt: data.submitted_at,
  };
}

/**
 * Apply to a job or internship — with the Skill Passport attached.
 *
 * This used to be a plain upsert into `applications`, which left
 * `passport_snapshot` and `match_score` empty: the employer's dashboard
 * showed a name and nothing to judge it by. `submit_application` is the
 * database's own path — it scores the profile against the role, freezes the
 * passport as it stood at the moment of applying, refuses a closed or
 * expired opening, and refuses a second application to the same one. The
 * cover note stays optional; the passport is what the employer reads.
 */
export async function applyToOpportunity(
  profileId: string,
  opportunitySlug: string,
  coverNote?: string,
): Promise<void> {
  const supabase = requireSupabase();
  const id = await resolveOpportunityId(opportunitySlug);
  if (!id) throw new Error("That opening isn't in the catalog yet.");
  void profileId; // The function reads the caller from the session.

  const { error } = await supabase.rpc("submit_application", {
    p_opportunity: id,
    ...(coverNote ? { p_cover_note: coverNote } : {}),
  });
  if (error) {
    // The database's messages are already in plain words; only the code
    // for "already applied" needs translating out of constraint-speak.
    if (error.code === "23505") throw new Error("You have already applied to this opening.");
    throw new Error(error.message);
  }
}

export async function withdrawApplication(
  profileId: string,
  opportunitySlug: string,
): Promise<void> {
  const supabase = requireSupabase();
  const id = await resolveOpportunityId(opportunitySlug);
  if (!id) return;

  const { error } = await supabase
    .from("applications")
    .update({ state: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("opportunity_id", id);
  if (error) throw new Error(error.message);
}

/* ── Cart ────────────────────────────────────────────────────────── */

/**
 * The course cart.
 *
 * Enrolment is per-course, but people browse in batches — three courses look
 * interesting, they want to decide together and start together. The cart
 * holds that intent, and checkout enrols every line in one go.
 *
 * Held on the device rather than in the database, because a cart is a
 * half-formed decision: it should work before anyone signs in, and it should
 * not follow you around as a commitment you never made. Checkout is the point
 * where intent becomes a record.
 */
const CART_KEY = "swayam-cart";

/** Course slugs currently in the cart. Local so it works signed-out too. */
export function readCart(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCart(slugs: string[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify([...new Set(slugs)]));
  } catch {
    /* private mode — the cart is simply not remembered */
  }
  // Same-tab listeners: `storage` only fires in *other* tabs.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }
}

/** Fired whenever the cart changes, so the badge and page stay in step. */
export const CART_EVENT = "swayam:cart";

export function addToCart(slug: string): string[] {
  const next = [...readCart(), slug];
  writeCart(next);
  return next;
}

export function removeFromCart(slug: string): string[] {
  const next = readCart().filter((s) => s !== slug);
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart([]);
}

export const inCart = (slug: string): boolean => readCart().includes(slug);

export interface CheckoutResult {
  enrolled: string[];
  failed: Array<{ slug: string; reason: string }>;
}

/**
 * Enrol every course in the cart.
 *
 * Each line is attempted independently: one course that has been unpublished
 * should not block the other two, so failures are reported per line rather
 * than aborting the whole checkout.
 */
export async function checkoutCart(profileId: string): Promise<CheckoutResult> {
  const slugs = readCart();
  const enrolled: string[] = [];
  const failed: Array<{ slug: string; reason: string }> = [];

  for (const slug of slugs) {
    try {
      await enrollInCourse(profileId, slug);
      enrolled.push(slug);
    } catch (error) {
      failed.push({
        slug,
        reason: error instanceof Error ? error.message : "Could not enroll.",
      });
    }
  }

  // Keep only the lines that failed, so a retry is one press.
  writeCart(failed.map((f) => f.slug));
  return { enrolled, failed };
}

/* ── Coupons ─────────────────────────────────────────────────────── */

export interface CouponQuote {
  valid: boolean;
  code?: string;
  description?: string | null;
  /** Amount taken off, in paise. */
  discountMinor: number;
  percentOff?: number | null;
  /** Why it does not apply, when `valid` is false. */
  reason?: string;
}

/**
 * Price a code against a subtotal.
 *
 * The arithmetic happens in Postgres, not here: a discount computed in the
 * browser is a discount the browser can rewrite. This only renders the answer.
 */
export async function quoteCoupon(code: string, subtotalMinor: number): Promise<CouponQuote> {
  const supabase = getSupabase();
  if (!supabase) return { valid: false, discountMinor: 0, reason: "Not connected." };

  const { data, error } = await supabase.rpc("price_coupon", {
    p_code: code.trim(),
    p_subtotal_minor: Math.max(0, Math.round(subtotalMinor)),
  });
  if (error) return { valid: false, discountMinor: 0, reason: error.message };

  const r = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

  return r["valid"] === true
    ? {
        valid: true,
        code: String(r["code"] ?? code).toUpperCase(),
        description: (r["description"] as string | null) ?? null,
        discountMinor: num(r["discount_minor"]),
        percentOff: r["percent_off"] === null ? null : num(r["percent_off"]),
      }
    : {
        valid: false,
        discountMinor: 0,
        reason: String(r["reason"] ?? "That code cannot be used."),
      };
}

/** Record that a code was actually used, once the basket is checked out. */
export async function redeemCoupon(code: string, discountMinor: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc("redeem_coupon", {
    p_code: code.trim(),
    p_discount_minor: Math.max(0, Math.round(discountMinor)),
  });
}

/**
 * Codes advertised on the checkout page.
 *
 * Only the ones marked listed. A partner code or a personal reward code is
 * perfectly usable but has no business appearing as a suggestion chip to
 * everyone who opens their cart.
 */
export async function listOffers(): Promise<
  Array<{ code: string; description: string | null; minSpendMinor: number }>
> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("coupons")
    .select("code, description, min_spend_minor, redemption_count, max_redemptions")
    .eq("is_active", true)
    .eq("is_listed", true)
    .is("issued_to", null)
    .order("min_spend_minor");
  if (error) return [];
  return (
    (data ?? [])
      // A code at its redemption cap is spent. Suggesting it produced a chip
      // that answered "fully claimed" when pressed — an advert for a discount
      // nobody can have.
      .filter((c) => c.max_redemptions === null || (c.redemption_count ?? 0) < c.max_redemptions)
      .map((c) => ({
        code: String(c.code).toUpperCase(),
        description: c.description,
        minSpendMinor: c.min_spend_minor ?? 0,
      }))
  );
}

/** Rupees from a free-text fee like "₹24,000" or "Free". Paise. */
export function feeToMinor(fee: string | undefined, free: boolean): number {
  if (free) return 0;
  if (!fee) return 0;
  const digits = fee.replace(/[^\d.]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Paise to a rupee string, grouped the Indian way. */
export function formatMinor(minor: number): string {
  return `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
