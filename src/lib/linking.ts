import { getItem, setItem } from "./store";
import { listAccounts, type Account } from "./auth";

/*
 * Parent-child links and teacher/volunteer assignments, kept on this device.
 *
 * These are LOCAL GROUPINGS only. Nothing here is a verified school or family
 * record: anyone using this device can link or assign any account.
 */

export interface Link {
  parentId: string;
  studentId: string;
  createdAt: string;
}

export interface Assignment {
  staffId: string;
  studentId: string;
}

export type LinkResult = { ok: true } | { ok: false; error: string };

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findByEmail(email: string): Account | undefined {
  const wanted = normaliseEmail(email);
  return listAccounts().find((a) => a.email.trim().toLowerCase() === wanted);
}

function findById(id: string): Account | undefined {
  return listAccounts().find((a) => a.id === id);
}

export function getLinks(): Link[] {
  return getItem<Link[]>("links", []);
}

export function linkChildByEmail(parentId: string, studentEmail: string): LinkResult {
  const parent = findById(parentId);
  if (!parent || parent.role !== "parent") {
    return { ok: false, error: "Only a parent account can link a child." };
  }
  const student = findByEmail(studentEmail);
  if (!student || student.role !== "student") {
    return { ok: false, error: "No student account with that email exists on this device." };
  }
  const links = getLinks();
  if (links.some((l) => l.parentId === parentId && l.studentId === student.id)) {
    return { ok: false, error: "This student is already linked to your account." };
  }
  setItem<Link[]>("links", [
    ...links,
    { parentId, studentId: student.id, createdAt: new Date().toISOString() },
  ]);
  return { ok: true };
}

export function linkedStudentIds(parentId: string): string[] {
  return getLinks()
    .filter((l) => l.parentId === parentId)
    .map((l) => l.studentId);
}

export function parentsOfStudent(studentId: string): string[] {
  return getLinks()
    .filter((l) => l.studentId === studentId)
    .map((l) => l.parentId);
}

// ── Teacher / volunteer grouping (local, not a verified school record) ──

export function getAssignments(): Assignment[] {
  return getItem<Assignment[]>("assignments", []);
}

export function assignStudent(staffId: string, studentEmail: string): LinkResult {
  const staff = findById(staffId);
  if (!staff || (staff.role !== "teacher" && staff.role !== "volunteer")) {
    return { ok: false, error: "Only a teacher or volunteer account can add students." };
  }
  const student = findByEmail(studentEmail);
  if (!student || student.role !== "student") {
    return { ok: false, error: "No student account with that email exists on this device." };
  }
  const assignments = getAssignments();
  if (assignments.some((a) => a.staffId === staffId && a.studentId === student.id)) {
    return { ok: false, error: "This student is already in your group." };
  }
  setItem<Assignment[]>("assignments", [...assignments, { staffId, studentId: student.id }]);
  return { ok: true };
}

export function assignedStudentIds(staffId: string): string[] {
  return getAssignments()
    .filter((a) => a.staffId === staffId)
    .map((a) => a.studentId);
}

/** True if this parent/teacher/volunteer may see this student's progress. */
export function canView(viewerId: string, studentId: string): boolean {
  if (viewerId === studentId) return true;
  return linkedStudentIds(viewerId).includes(studentId) || assignedStudentIds(viewerId).includes(studentId);
}

// ── Teacher recommendations (shown on the student's dashboard) ──

export interface Recommendation {
  id: string;
  staffId: string;
  staffName: string;
  studentId: string;
  chapterId: string;
  note: string;
  at: string;
  done: boolean;
}

export function getRecommendations(): Recommendation[] {
  return getItem<Recommendation[]>("recommendations", []);
}

export function recommendChapter(staffId: string, studentId: string, chapterId: string, note: string): LinkResult {
  const staff = findById(staffId);
  if (!staff || (staff.role !== "teacher" && staff.role !== "volunteer")) {
    return { ok: false, error: "Only a teacher or volunteer can assign work." };
  }
  if (!assignedStudentIds(staffId).includes(studentId)) {
    return { ok: false, error: "You can only assign work to students in your group." };
  }
  const rec: Recommendation = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    staffId,
    staffName: staff.name,
    studentId,
    chapterId,
    note: note.trim().slice(0, 200),
    at: new Date().toISOString(),
    done: false,
  };
  setItem<Recommendation[]>("recommendations", [...getRecommendations(), rec]);
  return { ok: true };
}

export function recommendationsFor(studentId: string): Recommendation[] {
  return getRecommendations()
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function setRecommendationDone(id: string, studentId: string, done: boolean): void {
  setItem<Recommendation[]>(
    "recommendations",
    getRecommendations().map((r) => (r.id === id && r.studentId === studentId ? { ...r, done } : r)),
  );
}
