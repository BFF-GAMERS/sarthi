import { getSupabase } from "./supabase";

/**
 * The skill board.
 *
 * One question, asked of the whole platform at once: for every skill, is there
 * anyone who can teach it, anyone who wants it, and a course covering it. That
 * is the shape of the exchange, and until now it could only be seen one skill
 * at a time from inside SkillSwap.
 *
 * Counts only — the function returns no names, so the board is safe to show to
 * a logged-out visitor. It says four people teach welding, never who they are.
 */
export interface BoardSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  trainers: number;
  masters: number;
  learners: number;
  courses: number;
}

export async function skillBoard(limit = 200): Promise<BoardSkill[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("skill_board", { p_limit: limit });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    category: r.category as string,
    trainers: Number(r.trainers ?? 0),
    masters: Number(r.masters ?? 0),
    learners: Number(r.learners ?? 0),
    courses: Number(r.courses ?? 0),
  }));
}

export interface BoardCourse {
  id: string;
  slug: string;
  title: string;
  level: string;
  isFree: boolean;
  priceMinor: number;
  skillId: string;
}

/**
 * The courses behind the board.
 *
 * The board counted courses per skill and then linked every row to the
 * unfiltered catalogue — so "3 courses" was a number you could not act on.
 * `courses.primary_skill_id` already carries the link; this reads it, so a row
 * can name the course and go straight to it.
 *
 * Published only. A draft course is not a route a learner can take today.
 */
export async function coursesBySkill(skillIds: string[]): Promise<Record<string, BoardCourse[]>> {
  const supabase = getSupabase();
  if (!supabase || skillIds.length === 0) return {};

  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, level, is_free, price_minor, primary_skill_id")
    .eq("is_published", true)
    .in("primary_skill_id", skillIds);
  if (error) throw new Error(error.message);

  const out: Record<string, BoardCourse[]> = {};
  for (const c of data ?? []) {
    const key = c.primary_skill_id;
    if (!key) continue;
    (out[key] ??= []).push({
      id: c.id,
      slug: c.slug,
      title: c.title,
      level: String(c.level),
      isFree: c.is_free ?? false,
      priceMinor: Number(c.price_minor ?? 0),
      skillId: key,
    });
  }
  return out;
}
