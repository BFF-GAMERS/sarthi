/**
 * Student rewards.
 *
 * Points are earned by the database — triggers fire when a course, lesson,
 * swap or assessment is genuinely finished — and spent here on discount codes
 * for paid courses. Nothing in the browser can mint points or codes; this file
 * only reads the balance and asks the database to redeem.
 *
 * XP and the spendable balance are different numbers on purpose. XP is the
 * permanent record behind level and badges; spending it would make someone
 * lose a level for claiming a reward they earned.
 */

import { getSupabase, requireSupabase } from "./supabase";

export interface Wallet {
  /** Lifetime record. Drives level and badges. Never decreases. */
  xp: number;
  level: number;
  /** What can be spent right now. */
  balance: number;
  spent: number;
  badgeCount: number;
  streakDays: number;
}

const EMPTY: Wallet = { xp: 0, level: 1, balance: 0, spent: 0, badgeCount: 0, streakDays: 0 };

export async function getWallet(profileId: string): Promise<Wallet> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY;

  const { data, error } = await supabase
    .from("reward_wallets")
    .select("xp, level, points_balance, points_spent, badge_count, streak_days")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY;

  return {
    xp: data.xp ?? 0,
    level: data.level ?? 1,
    balance: data.points_balance ?? 0,
    spent: data.points_spent ?? 0,
    badgeCount: data.badge_count ?? 0,
    streakDays: data.streak_days ?? 0,
  };
}

/* ── The reward catalogue ────────────────────────────────────────── */

export interface RewardOffer {
  slug: string;
  title: string;
  description: string | null;
  pointsCost: number;
  percentOff: number | null;
  amountOffMinor: number | null;
  maxDiscountMinor: number | null;
  minSpendMinor: number;
  validDays: number;
}

export async function listRewardOffers(): Promise<RewardOffer[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("reward_offers")
    .select(
      "slug, title, description, points_cost, percent_off, amount_off_minor, max_discount_minor, min_spend_minor, valid_days",
    )
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);

  return (data ?? []).map((o) => ({
    slug: String(o.slug),
    title: o.title,
    description: o.description,
    pointsCost: o.points_cost,
    percentOff: o.percent_off,
    amountOffMinor: o.amount_off_minor,
    maxDiscountMinor: o.max_discount_minor,
    minSpendMinor: o.min_spend_minor ?? 0,
    validDays: o.valid_days ?? 90,
  }));
}

export interface RedeemResult {
  ok: boolean;
  code?: string;
  title?: string;
  pointsSpent?: number;
  reason?: string;
}

/**
 * Exchange points for a code.
 *
 * The database checks the student role and the balance, so a modified client
 * gets nothing but a refusal.
 */
export async function redeemReward(offerSlug: string): Promise<RedeemResult> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("redeem_reward", { p_offer: offerSlug });
  if (error) return { ok: false, reason: error.message };

  const r = (data ?? {}) as Record<string, unknown>;
  return r["ok"] === true
    ? {
        ok: true,
        code: String(r["code"] ?? ""),
        title: String(r["title"] ?? ""),
        pointsSpent: Number(r["points_spent"] ?? 0),
      }
    : { ok: false, reason: String(r["reason"] ?? "That reward could not be claimed.") };
}

/* ── Codes the member holds ──────────────────────────────────────── */

export interface MyCoupon {
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffMinor: number | null;
  minSpendMinor: number;
  expiresAt: string | null;
  /** True once it has been used, so the list can show it spent. */
  used: boolean;
  source: string;
}

export async function listMyCoupons(profileId: string): Promise<MyCoupon[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const [{ data, error }, { data: used }] = await Promise.all([
    supabase
      .from("coupons")
      .select(
        "code, description, percent_off, amount_off_minor, min_spend_minor, expires_at, redemption_count, max_redemptions, source",
      )
      .eq("issued_to", profileId)
      .order("created_at", { ascending: false }),
    supabase.from("coupon_redemptions").select("code").eq("profile_id", profileId),
  ]);
  if (error) throw new Error(error.message);

  const spent = new Set((used ?? []).map((r) => String(r.code).toUpperCase()));

  return (data ?? []).map((c) => ({
    code: String(c.code).toUpperCase(),
    description: c.description,
    percentOff: c.percent_off,
    amountOffMinor: c.amount_off_minor,
    minSpendMinor: c.min_spend_minor ?? 0,
    expiresAt: c.expires_at,
    used: spent.has(String(c.code).toUpperCase()),
    source: c.source ?? "reward",
  }));
}

/* ── How points were earned ──────────────────────────────────────── */

export interface EarningEntry {
  id: number;
  reason: string;
  label: string;
  delta: number;
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  course_completed: "Completed a course",
  lesson_completed: "Finished a lesson",
  swap_completed: "Completed a skill swap",
  session_completed: "Finished a session",
  assessment_passed: "Passed an assessment",
  certificate_issued: "Earned a certificate",
  badge_awarded: "Unlocked a badge",
  profile_completed: "Completed your profile",
  skill_added: "Added a skill",
  endorsement_received: "Received an endorsement",
  review_received: "Received a review",
  reward_redeemed: "Claimed a reward",
  signup: "Joined स्वYAM",
};

export async function listEarnings(profileId: string, limit = 20): Promise<EarningEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("points_ledger")
    .select("id, delta, reason, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const reason = r.reason ?? "";
    return {
      id: r.id,
      reason,
      label:
        REASON_LABEL[reason] ??
        (reason
          ? reason.replace(/[._-]+/g, " ").replace(/^./, (m) => m.toUpperCase())
          : "Activity"),
      delta: r.delta ?? 0,
      createdAt: r.created_at,
    };
  });
}

/* ── Administration ──────────────────────────────────────────────── */

export interface CreateCouponInput {
  /** Leave blank to have one generated. Punctuation and case are normalised. */
  code?: string;
  percentOff?: number | null;
  amountOffMinor?: number | null;
  minSpendMinor?: number;
  maxDiscountMinor?: number | null;
  /** Null for a code that never expires. */
  validDays?: number | null;
  maxRedemptions?: number | null;
  maxPerProfile?: number;
  /** False keeps it usable but off the checkout page. */
  isListed?: boolean;
  description?: string;
}

export interface CreateCouponResult {
  ok: boolean;
  code?: string;
  reason?: string;
}

/**
 * Create a code.
 *
 * Returns a refusal rather than throwing for the things an administrator will
 * actually hit — a name already taken, a code too short — because those are
 * answers to show in the form, not faults.
 */
export async function adminCreateCoupon(input: CreateCouponInput): Promise<CreateCouponResult> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("admin_create_coupon", {
    p_code: input.code?.trim() || undefined,
    p_percent_off: input.percentOff ?? undefined,
    p_amount_off_minor: input.amountOffMinor ?? undefined,
    p_min_spend_minor: input.minSpendMinor ?? 0,
    p_max_discount_minor: input.maxDiscountMinor ?? undefined,
    p_valid_days: input.validDays ?? undefined,
    p_max_redemptions: input.maxRedemptions ?? undefined,
    p_max_per_profile: input.maxPerProfile ?? 1,
    p_is_listed: input.isListed ?? true,
    p_description: input.description ?? undefined,
  });
  if (error) return { ok: false, reason: error.message };

  const r = (data ?? {}) as Record<string, unknown>;
  return r["ok"] === true
    ? { ok: true, code: String(r["code"] ?? "") }
    : { ok: false, reason: String(r["reason"] ?? "That code could not be created.") };
}

export interface DeleteCouponResult {
  ok: boolean;
  reason?: string;
}

/**
 * Delete a code outright.
 *
 * The database refuses once it has been redeemed — those rows record a
 * discount somebody actually received. The refusal explains that and points
 * at disabling instead.
 */
export async function adminDeleteCoupon(code: string): Promise<DeleteCouponResult> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("admin_delete_coupon", { p_code: code });
  if (error) return { ok: false, reason: error.message };

  const r = (data ?? {}) as Record<string, unknown>;
  return r["ok"] === true
    ? { ok: true }
    : { ok: false, reason: String(r["reason"] ?? "That code could not be removed.") };
}

/** Show or hide a code on the checkout page. */
export async function adminSetCouponListed(code: string, listed: boolean): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("admin_set_coupon_listed", {
    p_code: code,
    p_listed: listed,
  });
  if (error) throw new Error(error.message);
}

/** Every code on the platform, for the admin screen. */
export interface AdminCoupon {
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffMinor: number | null;
  minSpendMinor: number;
  redemptionCount: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  isActive: boolean;
  /** Whether it appears as a suggestion in the cart. */
  isListed: boolean;
  source: string;
  /** Set when the code belongs to one member, from a reward. */
  issuedTo: string | null;
}

export async function listAllCoupons(limit = 200): Promise<AdminCoupon[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("coupons")
    .select(
      "code, description, percent_off, amount_off_minor, min_spend_minor, redemption_count, max_redemptions, expires_at, is_active, is_listed, source, issued_to",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    code: String(c.code).toUpperCase(),
    description: c.description,
    percentOff: c.percent_off,
    amountOffMinor: c.amount_off_minor,
    minSpendMinor: c.min_spend_minor ?? 0,
    redemptionCount: c.redemption_count ?? 0,
    maxRedemptions: c.max_redemptions,
    expiresAt: c.expires_at,
    isActive: c.is_active,
    isListed: c.is_listed ?? true,
    source: c.source ?? "campaign",
    issuedTo: c.issued_to,
  }));
}

export async function setCouponActive(code: string, active: boolean): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("coupons").update({ is_active: active }).eq("code", code);
  if (error) throw new Error(error.message);
}
