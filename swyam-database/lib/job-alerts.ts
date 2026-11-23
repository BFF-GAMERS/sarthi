import { getSupabase, requireSupabase } from "./supabase";
import type { Database } from "../types/database";

/**
 * Job alerts: a saved filter that turns into a notification.
 *
 * The catalogue is small, and the right response to "nothing for me this
 * week" is not a fuller-looking page — it is to remember what the member
 * wanted and tell them the day it is posted. The rows live in `job_alerts`;
 * the matching runs in the database when an opening is published (db/022),
 * so it happens whether or not the member ever opens the site again.
 */

export type WorkMode = Database["public"]["Enums"]["work_mode"];
export type OpportunityKind = Database["public"]["Enums"]["opportunity_kind"];

export interface JobAlert {
  id: string;
  city: string | null;
  skills: string[];
  /** Whole rupees per month, or null for any pay. */
  minPay: number | null;
  workMode: WorkMode | null;
  kind: OpportunityKind | null;
  createdAt: string;
  lastMatchedAt: string | null;
}

export interface JobAlertInput {
  city: string | null;
  skills: string[];
  minPay: number | null;
  workMode: WorkMode | null;
  kind: OpportunityKind | null;
}

export const ALERT_MAX = 4;

const missingTable = (e: { code?: string; message: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || /does not exist|find the table/i.test(e.message);

/** `available` is false until db/022 has been run. */
export async function myAlerts(
  profileId: string,
): Promise<{ alerts: JobAlert[]; available: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { alerts: [], available: false };

  const { data, error } = await supabase
    .from("job_alerts")
    .select("id, city, skills, min_pay_minor, work_mode, kind, created_at, last_matched_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingTable(error)) return { alerts: [], available: false };
    throw new Error(error.message);
  }
  return {
    available: true,
    alerts: (data ?? []).map((r) => ({
      id: r.id,
      city: r.city,
      skills: r.skills ?? [],
      minPay: typeof r.min_pay_minor === "number" ? Math.round(r.min_pay_minor / 100) : null,
      workMode: r.work_mode,
      kind: r.kind,
      createdAt: r.created_at,
      lastMatchedAt: r.last_matched_at,
    })),
  };
}

export async function createAlert(profileId: string, input: JobAlertInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("job_alerts").insert({
    profile_id: profileId,
    city: input.city?.trim() || null,
    skills: input.skills
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
    min_pay_minor: input.minPay && input.minPay > 0 ? Math.round(input.minPay) * 100 : null,
    work_mode: input.workMode,
    kind: input.kind,
  });
  if (error) {
    if (missingTable(error)) throw new Error("Alerts are not switched on for this site yet.");
    throw new Error(error.message);
  }
}

export async function deleteAlert(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("job_alerts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** One line that says what the alert watches for. */
export function describeAlert(a: JobAlert): string {
  const parts: string[] = [];
  parts.push(
    a.kind === "internship" ? "Internships" : a.kind === "job" ? "Jobs" : "Jobs and internships",
  );
  if (a.skills.length) parts.push(a.skills.join(", "));
  parts.push(a.city ? `in ${a.city}` : "anywhere");
  if (a.workMode) parts.push(a.workMode === "onsite" ? "in person" : a.workMode);
  if (a.minPay) parts.push(`from ₹${a.minPay.toLocaleString("en-IN")}/month`);
  return parts.join(" · ");
}
