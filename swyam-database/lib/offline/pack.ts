import { getSupabase } from "../supabase";
import { getLearnState } from "../learn";
import { estimateQuota, deletePack, deleteAllPacks, listPacks, putPack } from "./store";
import type { PackLesson, StoredPack } from "./store";
import { hasRoomFor, measureBytes } from "./format";
import { precacheLearnPage, registerOfflineSw, unregisterOfflineSw } from "./sw-register";

/**
 * Downloading a course's lessons for offline study.
 *
 * Reads only. The one Supabase call that is not a plain select is the existing
 * `course_learning_state` RPC, which only reads and is the thing that decides
 * which modules this learner may open: a pack never contains a module the
 * server would still have locked. Nothing here writes to Supabase, and nothing
 * the learner does offline (marking complete, notes, assessments, enrolling,
 * submitting) is queued or replayed; those controls say "Needs a connection".
 */

export type OfflineErrorCode =
  | "unavailable" // no IndexedDB in this browser
  | "no-connection"
  | "not-found"
  | "not-enrolled"
  | "empty"
  | "storage-full"
  | "aborted"
  | "failed";

export class OfflineError extends Error {
  readonly code: OfflineErrorCode;
  constructor(code: OfflineErrorCode, message?: string) {
    super(message ?? code);
    this.name = "OfflineError";
    this.code = code;
  }
}

export interface PackProgress {
  done: number;
  total: number;
  moduleTitle: string;
}

export interface SizeEstimate {
  bytes: number;
  lessons: number;
  modules: number;
}

/* ── Content: text only ─────────────────────────────────────────── */

const TEXT_KEYS = [
  "objective",
  "body",
  "concepts",
  "example",
  "checklist",
  "resources",
  "practice",
] as const;

/**
 * Reduce a lesson's `content` JSON to the fields the Learn page renders as
 * text. Anything else (an embed, a media URL somebody put in the blob) is left
 * behind: a pack is lesson text, nothing a third party hosts.
 */
export function sanitizeContent(content: unknown): Record<string, unknown> {
  if (!content || typeof content !== "object" || Array.isArray(content)) return {};
  const src = content as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TEXT_KEYS) {
    if (src[key] !== undefined && src[key] !== null) out[key] = src[key];
  }
  return out;
}

/* ── Fetching ───────────────────────────────────────────────────── */

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

interface LessonRow {
  id: string;
  title: string;
  position: number;
  kind: string;
  duration_minutes: number | null;
  content: unknown;
  transcript: string | null;
}

/** Fetch the lessons the signed-in learner may open now. Read-only. */
async function collect(
  courseSlug: string,
  opts: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void } = {},
): Promise<StoredPack> {
  const { signal, onProgress } = opts;
  if (isOffline()) throw new OfflineError("no-connection");
  const supabase = getSupabase();
  if (!supabase) throw new OfflineError("unavailable", "Supabase is not configured");

  let state: Awaited<ReturnType<typeof getLearnState>>;
  try {
    state = await getLearnState(courseSlug);
  } catch {
    throw new OfflineError(isOffline() ? "no-connection" : "failed");
  }
  if (!state) throw new OfflineError("not-found");
  if (!state.enrolled) throw new OfflineError("not-enrolled");

  const modules = state.modules.filter((m) => m.unlocked && m.lessons.length > 0);
  const total = modules.reduce((n, m) => n + m.lessons.length, 0);
  if (total === 0) throw new OfflineError("empty");

  const lessons: PackLesson[] = [];
  let done = 0;
  onProgress?.({ done, total, moduleTitle: modules[0]?.title ?? "" });

  for (const m of modules) {
    if (signal?.aborted) throw new OfflineError("aborted");

    let query = supabase
      .from("lessons")
      .select("id, title, position, kind, duration_minutes, content, transcript")
      .in(
        "id",
        m.lessons.map((l) => l.id),
      );
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (signal?.aborted) throw new OfflineError("aborted");
    if (error) throw new OfflineError(isOffline() ? "no-connection" : "failed", error.message);

    const rows = new Map<string, LessonRow>(
      ((data ?? []) as unknown as LessonRow[]).map((r) => [r.id, r]),
    );
    for (const l of m.lessons) {
      const r = rows.get(l.id);
      if (!r) continue; // the server did not let this learner read it: not ours to store
      lessons.push({
        id: r.id,
        title: r.title,
        position: r.position,
        moduleTitle: m.title,
        modulePosition: m.position,
        kind: String(r.kind),
        durationMinutes: r.duration_minutes ?? null,
        content: sanitizeContent(r.content),
        transcript: r.transcript ?? null,
      });
    }
    done += m.lessons.length;
    onProgress?.({ done, total, moduleTitle: m.title });
  }

  if (lessons.length === 0) throw new OfflineError("empty");

  const pack: StoredPack = {
    courseSlug,
    title: state.title,
    bytes: 0,
    savedAt: Date.now(),
    lessons,
  };
  pack.bytes = measureBytes(pack);
  return pack;
}

/**
 * How big the pack would be, measured on the real text before anything is
 * written. Shown to the learner as "About 180 KB" before they commit data.
 */
export async function estimatePackSize(
  courseSlug: string,
  signal?: AbortSignal,
): Promise<SizeEstimate> {
  const pack = await collect(courseSlug, signal ? { signal } : {});
  return {
    bytes: pack.bytes,
    lessons: pack.lessons.length,
    modules: new Set(pack.lessons.map((l) => l.moduleTitle)).size,
  };
}

/** Fetch a module at a time, report progress, then store. */
export async function downloadPack(
  courseSlug: string,
  opts: { onProgress?: (p: PackProgress) => void; signal?: AbortSignal } = {},
): Promise<StoredPack> {
  // Register early: by the time the text is in, the worker is ready to cache the page.
  void registerOfflineSw();

  const pack = await collect(courseSlug, opts);
  if (opts.signal?.aborted) throw new OfflineError("aborted");

  if (!hasRoomFor(pack.bytes, await estimateQuota())) throw new OfflineError("storage-full");

  const res = await putPack(pack);
  if (!res.ok) {
    throw new OfflineError(
      res.reason === "quota"
        ? "storage-full"
        : res.reason === "unavailable"
          ? "unavailable"
          : "failed",
    );
  }

  // Best effort: the lesson text is already safe even if the page cache is not.
  await precacheLearnPage(courseSlug, opts.signal);
  return pack;
}

/** Delete one pack; when it was the last, take the worker and its cache with it. */
export async function removePack(courseSlug: string): Promise<boolean> {
  const res = await deletePack(courseSlug);
  if (!res.ok) return false;
  if ((await listPacks()).length === 0) await unregisterOfflineSw();
  return true;
}

export async function removeAllPacks(): Promise<boolean> {
  const res = await deleteAllPacks();
  if (!res.ok) return false;
  await unregisterOfflineSw();
  return true;
}
