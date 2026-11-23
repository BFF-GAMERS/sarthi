import { getItem, setItem } from "./store";

export type CourseOverride = { hidden?: boolean; title?: string };

const KEY = "courseOverrides";

/** Admin overrides per course id. Saved only; public course pages do not read them yet. */
export function getCourseOverrides(): Record<string, CourseOverride> {
  return getItem<Record<string, CourseOverride>>(KEY, {});
}

/** Merges a patch into one course's override and saves it. */
export function setCourseOverride(id: string, patch: CourseOverride): void {
  const all = getCourseOverrides();
  setItem<Record<string, CourseOverride>>(KEY, { ...all, [id]: { ...all[id], ...patch } });
}
