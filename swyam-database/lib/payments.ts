import { requireSupabase } from "./supabase";

/**
 * Paying for a course.
 *
 * A provider abstraction rather than a payment integration. No card is taken
 * and no money moves — but nothing here pretends otherwise: the price is read
 * from the course row on the server, a real `payments` row is written with its
 * provider named honestly as `demo`, and the enrolment is linked to it. An
 * enrolment on a ₹12,000 course now has a payment behind it, even if that
 * payment's meta says in plain words that nothing was charged.
 *
 * Wiring a real provider means adding a branch: create the order, return
 * `requires_action` with its reference, and confirm on the webhook. The
 * enrolment side of this does not change, which is the point of putting the
 * seam here.
 */

export type PaymentProvider = "demo";

export interface EnrolResult {
  ok: boolean;
  /** True when the person was already enrolled — nothing was charged again. */
  already: boolean;
  enrollmentId: string;
  paymentId: string | null;
  amountMinor: number;
  currency: string;
}

/** Rupees from paise, formatted the way the rest of the site does it. */
export function formatPrice(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

/**
 * Enrol, paying first if the course is not free.
 *
 * One server call, so there is no window in which a payment succeeds and the
 * enrolment does not — or the reverse. The amount is never sent from here.
 */
export async function enrolWithPayment(
  courseSlug: string,
  provider: PaymentProvider = "demo",
): Promise<EnrolResult> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc("enroll_with_payment", {
    p_course_slug: courseSlug,
    p_provider: provider,
    // A reference the demo provider can be traced by, in the shape a real one
    // would use. Not random: it identifies this attempt in the payments table.
    p_provider_ref: `demo_${courseSlug}_${Date.now()}`,
  });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(r["ok"]),
    already: Boolean(r["already"]),
    enrollmentId: String(r["enrollment_id"] ?? ""),
    paymentId: (r["payment_id"] as string | null) ?? null,
    amountMinor: Number(r["amount_minor"] ?? 0),
    currency: String(r["currency"] ?? "INR"),
  };
}
