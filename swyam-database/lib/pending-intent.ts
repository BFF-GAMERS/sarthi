/**
 * The thing you were doing when we asked you to sign in.
 *
 * Pressing Save on a course while signed out used to turn the icon dark and
 * save nothing; pressing Enrol or Apply sent you to a login form and, after
 * it, to the dashboard — the course you had chosen was gone, and you had to
 * find it again. The sign-in wall was losing the intent that reached it.
 *
 * So the intent is written down first, `?next=` carries the page back, and
 * the moment the session is real the intent is either carried out (a save)
 * or re-opened where it was (an enrolment, an application).
 *
 * Kept on the device, and only for a few minutes: it is a half-finished tap,
 * not a record. Anything older is somebody else's session or a forgotten
 * tab, and is discarded rather than acted on.
 */

const KEY = "swayam-intent";
const MAX_AGE_MS = 15 * 60_000;

export type IntentKind = "save-course" | "save-job" | "enrol" | "apply";

export interface PendingIntent {
  kind: IntentKind;
  /** Catalogue slug of the course or opening. */
  slug: string;
  /** What it is called, so the toast can name it. */
  title: string;
  /** Where the person was, to come back to. */
  path: string;
  at: number;
}

export function rememberIntent(intent: Omit<PendingIntent, "at">): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() }));
  } catch {
    /* Private window, or storage full. The `next=` param still gets them back. */
  }
}

/** Read and clear. Returns null when there is nothing, or nothing recent. */
export function takeIntent(): PendingIntent | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const v = JSON.parse(raw) as PendingIntent;
    if (!v || typeof v.slug !== "string" || typeof v.at !== "number") return null;
    if (Date.now() - v.at > MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function clearIntent(): void {
  try {
    localStorage?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/*
 * Resuming on the page itself.
 *
 * A save can be finished from anywhere. An enrolment or an application
 * cannot: the confirmation, the fee and the cover note all live on the item's
 * own page, so the intent leaves a flag there and the page opens the right
 * panel when it loads. Session storage, because this is true of this tab
 * only and should not outlive it.
 */
const RESUME_KEY = "swayam-resume";

export function markResume(kind: IntentKind, slug: string): void {
  try {
    sessionStorage?.setItem(RESUME_KEY, `${kind}:${slug}`);
  } catch {
    /* fine — the page just will not auto-open */
  }
}

/** True once, for the matching page. Clears itself. */
export function shouldResume(kind: IntentKind, slug: string): boolean {
  try {
    const v = sessionStorage?.getItem(RESUME_KEY);
    if (v !== `${kind}:${slug}`) return false;
    sessionStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ── Drafts ──────────────────────────────────────────────────────────
 *
 * The cover note somebody typed before they were asked to sign in, or
 * before they closed the tab by accident. Per opening, on the device.
 */
const DRAFT_PREFIX = "swayam-draft:";

export function saveDraft(slug: string, text: string): void {
  try {
    if (text.trim()) localStorage?.setItem(DRAFT_PREFIX + slug, text);
    else localStorage?.removeItem(DRAFT_PREFIX + slug);
  } catch {
    /* the note stays in the box either way */
  }
}

export function loadDraft(slug: string): string {
  try {
    return localStorage?.getItem(DRAFT_PREFIX + slug) ?? "";
  } catch {
    return "";
  }
}

export function clearDraft(slug: string): void {
  try {
    localStorage?.removeItem(DRAFT_PREFIX + slug);
  } catch {
    /* already gone */
  }
}
