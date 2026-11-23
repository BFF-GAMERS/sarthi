import { getSupabase, requireSupabase } from "./supabase";
import type { Database } from "../types/database";

/**
 * An application, followed from both ends.
 *
 * The applicant sees a line of steps — Applied, Viewed, Shortlisted,
 * Interview, Decision — with the date each one was reached. The employer sees
 * the same application and moves it along. The dates come from
 * `application_events`, which a database trigger writes on every state change
 * (db/021), so neither side can invent a step that did not happen.
 *
 * Until that migration has run the events table does not exist. Everything
 * here degrades to the one fact the `applications` row always carried: the
 * current state and when it changed. The tracker still renders; it just has
 * fewer dates on it.
 */

export type ApplicationState = Database["public"]["Enums"]["application_state"];

/** The five steps the tracker draws, in order. Terminal states share the last one. */
export const TRACKER_STEPS = [
  { id: "submitted", label: "Applied" },
  { id: "under_review", label: "Viewed" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interviewing", label: "Interview" },
  { id: "decision", label: "Decision" },
] as const;

/** Where a state sits on the tracker; -1 for withdrawn / draft. */
export function stepIndex(state: ApplicationState): number {
  switch (state) {
    case "submitted":
      return 0;
    case "under_review":
      return 1;
    case "shortlisted":
      return 2;
    case "interviewing":
      return 3;
    case "offered":
    case "hired":
    case "rejected":
      return 4;
    default:
      return -1;
  }
}

/** The state in the applicant's words. */
export function stateLabel(state: ApplicationState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Applied";
    case "under_review":
      return "Viewed by employer";
    case "shortlisted":
      return "Shortlisted";
    case "interviewing":
      return "Interview stage";
    case "offered":
      return "Offer made";
    case "hired":
      return "Selected";
    case "rejected":
      return "Not selected this time";
    case "withdrawn":
      return "Withdrawn";
  }
}

export const isDecided = (state: ApplicationState) =>
  state === "offered" || state === "hired" || state === "rejected" || state === "withdrawn";

/** What an employer may set, in the order the pipeline runs. */
export const EMPLOYER_STATES: { id: ApplicationState; label: string }[] = [
  { id: "submitted", label: "Applied (not yet viewed)" },
  { id: "under_review", label: "Viewed" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interviewing", label: "Interview" },
  { id: "offered", label: "Offer made" },
  { id: "hired", label: "Selected" },
  { id: "rejected", label: "Not selected" },
];

export interface MyApplication {
  id: string;
  state: ApplicationState;
  submittedAt: string;
  stateChangedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  coverNote: string | null;
  opportunity: {
    slug: string;
    title: string;
    kind: string;
    location: string | null;
    workMode: string;
    deadline: string | null;
    closedAt: string | null;
    employer: { name: string; slug: string; isVerified: boolean } | null;
  } | null;
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  fromState: ApplicationState | null;
  toState: ApplicationState;
  note: string | null;
  createdAt: string;
}

export async function myApplications(profileId: string): Promise<MyApplication[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, state, submitted_at, state_changed_at, decided_at, decision_note, cover_note, " +
        "opportunities:opportunity_id ( slug, title, kind, location, work_mode, application_deadline, closed_at, " +
        "companies:company_id ( name, slug, is_verified ) )",
    )
    .eq("profile_id", profileId)
    .order("state_changed_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    (data ?? []) as unknown as Array<{
      id: string;
      state: ApplicationState;
      submitted_at: string;
      state_changed_at: string;
      decided_at: string | null;
      decision_note: string | null;
      cover_note: string | null;
      opportunities: {
        slug: string;
        title: string;
        kind: string;
        location: string | null;
        work_mode: string;
        application_deadline: string | null;
        closed_at: string | null;
        companies: { name: string; slug: string; is_verified: boolean } | null;
      } | null;
    }>
  ).map((a) => ({
    id: a.id,
    state: a.state,
    submittedAt: a.submitted_at,
    stateChangedAt: a.state_changed_at,
    decidedAt: a.decided_at,
    decisionNote: a.decision_note,
    coverNote: a.cover_note,
    opportunity: a.opportunities
      ? {
          slug: a.opportunities.slug,
          title: a.opportunities.title,
          kind: String(a.opportunities.kind),
          location: a.opportunities.location,
          workMode: String(a.opportunities.work_mode),
          deadline: a.opportunities.application_deadline,
          closedAt: a.opportunities.closed_at,
          employer: a.opportunities.companies
            ? {
                name: a.opportunities.companies.name,
                slug: a.opportunities.companies.slug,
                isVerified: a.opportunities.companies.is_verified,
              }
            : null,
        }
      : null,
  }));
}

/**
 * The history of some applications.
 *
 * `available` is false when the events table is not there yet (db/021 not
 * run); callers then fall back to the row's own timestamps rather than
 * showing an error for a feature that is merely not switched on.
 */
export async function applicationEvents(
  applicationIds: string[],
): Promise<{ events: ApplicationEvent[]; available: boolean }> {
  const supabase = getSupabase();
  if (!supabase || applicationIds.length === 0) return { events: [], available: true };

  const { data, error } = await supabase
    .from("application_events")
    .select("id, application_id, from_state, to_state, note, created_at")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: true });

  if (error) {
    // 42P01: relation does not exist. PostgREST reports a missing table as
    // PGRST205 ("Could not find the table") on newer versions.
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /does not exist|find the table/i.test(error.message)
    ) {
      return { events: [], available: false };
    }
    throw new Error(error.message);
  }

  return {
    available: true,
    events: (data ?? []).map((e) => ({
      id: e.id,
      applicationId: e.application_id,
      fromState: e.from_state,
      toState: e.to_state,
      note: e.note,
      createdAt: e.created_at,
    })),
  };
}

export async function withdrawById(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("applications")
    .update({ state: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * The employer moves an application.
 *
 * The row-level policy lets any member of the hiring company update, and the
 * guard trigger (db/021) refuses everyone else, so there is nothing to check
 * here beyond passing the state on. A note travels only with a decision; on
 * any other step it would be lost, so it is not offered there.
 */
export async function setApplicationState(
  id: string,
  state: ApplicationState,
  note?: string,
): Promise<void> {
  const supabase = requireSupabase();
  const decision = state === "offered" || state === "hired" || state === "rejected";
  const { error } = await supabase
    .from("applications")
    .update({
      state,
      decision_note: decision ? note?.trim() || null : null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "42501") throw new Error("Only the hiring company can change this.");
    throw new Error(error.message);
  }
}
