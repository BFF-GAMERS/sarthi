/**
 * Local persistence for Swayam Plus: one JSON blob per scope under `swayam.plan.<scope>`
 * (scope = guest | acct_<8 hex> | lab_main | preview_<persona>, the same scopes the evolution engine uses).
 *
 *   plus       what the sheet remembers: shown count, snooze, "never", the honest-CTA choice
 *   cache      the chosen ordering per (profileType, state, mode), good for 14 days
 *   lastAiAt   when the AI was last asked: at most one call per 7 days per scope
 *   role       the profile type the memory was built for; a change resets the snooze
 *
 * Every read and write is wrapped: a private window, blocked site data or a full disk leaves the in-memory
 * copy in charge, and the page renders correctly without storage at all. Nothing here is sent anywhere.
 */
import type { ProfileType } from "../../lib/profile-type";
import { cacheKeyOf, validateChoice } from "../core/chooser";
import {
  applyDismiss,
  applyInterest,
  applyShown,
  parsePlusState,
  resetForRoleChange,
} from "../core/plus-state";
import type { ChooserInput, PlanChoice, PlusState } from "../core/types";
import { DEFAULT_PLUS_STATE } from "../core/types";
import type { PlusDismissKind } from "../config/events";

export const STORE_PREFIX = "swayam.plan.";
const DAY = 24 * 60 * 60_000;
export const CACHE_TTL_MS = 14 * DAY;
export const AI_MIN_GAP_MS = 7 * DAY;
const MAX_CACHE_ENTRIES = 12;

interface CacheEntry {
  at: number;
  choice: unknown;
}

export interface PlanBlob {
  v: 1;
  plus: PlusState;
  cache: Record<string, CacheEntry>;
  lastAiAt: number | null;
  role: ProfileType | null;
}

const freshBlob = (): PlanBlob => ({
  v: 1,
  plus: { ...DEFAULT_PLUS_STATE },
  cache: {},
  lastAiAt: null,
  role: null,
});

/* ── raw access, never throws ────────────────────────────────────── */

const memory = new Map<string, string>();
const keyOf = (scope: string): string => `${STORE_PREFIX}${scope}`;

function readRaw(scope: string): string | null {
  const k = keyOf(scope);
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    }
  } catch {
    /* blocked or unavailable: fall through to memory */
  }
  return memory.get(k) ?? null;
}

function writeRaw(scope: string, value: string): void {
  const k = keyOf(scope);
  memory.set(k, value);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(k, value);
  } catch {
    /* quota or blocked: the memory copy carries on */
  }
}

/** Tests only. */
export const _resetStorageForTests = (): void => {
  memory.clear();
  snapshots.clear();
  listeners.clear();
};

/* ── blob ────────────────────────────────────────────────────────── */

const isRole = (v: unknown): v is ProfileType =>
  v === "school" ||
  v === "college" ||
  v === "jobseeker" ||
  v === "professional" ||
  v === "recruiter" ||
  v === "institute";

function parseBlob(raw: string | null): PlanBlob {
  if (!raw) return freshBlob();
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return freshBlob();
  }
  if (typeof o !== "object" || o === null) return freshBlob();
  const r = o as Record<string, unknown>;
  const cache: Record<string, CacheEntry> = {};
  if (typeof r["cache"] === "object" && r["cache"] !== null) {
    for (const [k, e] of Object.entries(r["cache"] as Record<string, unknown>).slice(
      0,
      MAX_CACHE_ENTRIES,
    )) {
      const at = (e as { at?: unknown } | null)?.at;
      if (typeof at === "number" && Number.isFinite(at))
        cache[k] = { at, choice: (e as CacheEntry).choice };
    }
  }
  const lastAiAt = r["lastAiAt"];
  return {
    v: 1,
    plus: parsePlusState(r["plus"]),
    cache,
    lastAiAt: typeof lastAiAt === "number" && Number.isFinite(lastAiAt) ? lastAiAt : null,
    role: isRole(r["role"]) ? r["role"] : null,
  };
}

export const readBlob = (scope: string): PlanBlob => parseBlob(readRaw(scope));

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key.startsWith(STORE_PREFIX)) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function writeBlob(scope: string, blob: PlanBlob): void {
  writeRaw(scope, JSON.stringify(blob));
  emit();
}

/* ── the sheet's memory ──────────────────────────────────────────── */

const snapshots = new Map<string, { raw: string | null; plus: PlusState }>();

/** A stable reference while the stored text is unchanged, so useSyncExternalStore does not loop. */
export function plusSnapshot(scope: string): PlusState {
  const raw = readRaw(scope);
  const hit = snapshots.get(scope);
  if (hit && hit.raw === raw) return hit.plus;
  const plus = parseBlob(raw).plus;
  snapshots.set(scope, { raw, plus });
  return plus;
}

export function updatePlus(scope: string, fn: (s: PlusState) => PlusState): PlusState {
  const blob = readBlob(scope);
  blob.plus = fn(blob.plus);
  writeBlob(scope, blob);
  return blob.plus;
}

export const recordShown = (scope: string, now: number): PlusState =>
  updatePlus(scope, (s) => applyShown(s, now));
export const recordDismiss = (scope: string, kind: PlusDismissKind, now: number): PlusState =>
  updatePlus(scope, (s) => applyDismiss(s, kind, now));
export const recordInterest = (scope: string, interest: "trial_demo" | "notify"): PlusState =>
  updatePlus(scope, (s) => applyInterest(s, interest));

/**
 * Called when the profile type is known. Stamps `signupAt` the first time (first seen on this device, a
 * conservative stand-in for signup) and, if the type changed since last time, resets the snooze.
 */
export function noteRole(scope: string, role: ProfileType, now: number): void {
  const blob = readBlob(scope);
  let changed = false;
  if (blob.plus.signupAt === undefined) {
    blob.plus = { ...blob.plus, signupAt: now };
    changed = true;
  }
  if (blob.role !== role) {
    if (blob.role !== null) blob.plus = resetForRoleChange(blob.plus);
    blob.role = role;
    changed = true;
  }
  if (changed) writeBlob(scope, blob);
}

/* ── the cached choice and the weekly AI cap ─────────────────────── */

/** A fresh, valid cached choice for this (profileType, state, mode), or null. Re-validated on every read. */
export function getCachedChoice(
  scope: string,
  input: ChooserInput,
  now: number,
): PlanChoice | null {
  const e = readBlob(scope).cache[cacheKeyOf(input)];
  if (!e || now - e.at > CACHE_TTL_MS || e.at > now + DAY) return null;
  const checked = validateChoice(e.choice, input.profileType);
  return checked.ok ? checked.value : null;
}

export function putCachedChoice(
  scope: string,
  input: ChooserInput,
  choice: PlanChoice,
  now: number,
): void {
  const blob = readBlob(scope);
  blob.cache[cacheKeyOf(input)] = { at: now, choice };
  const live = Object.entries(blob.cache)
    .filter(([, e]) => now - e.at <= CACHE_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_CACHE_ENTRIES);
  blob.cache = Object.fromEntries(live);
  writeBlob(scope, blob);
}

/** At most one AI call per scope per 7 days. A failed call still counts: the rules cover the week. */
export const aiCallAllowed = (scope: string, now: number): boolean => {
  const last = readBlob(scope).lastAiAt;
  return last === null || now - last >= AI_MIN_GAP_MS || last > now;
};

export function markAiCall(scope: string, now: number): void {
  const blob = readBlob(scope);
  blob.lastAiAt = now;
  writeBlob(scope, blob);
}
