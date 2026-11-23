import { getSupabase, requireSupabase } from "./supabase";

type AnyTable = Parameters<ReturnType<typeof requireSupabase>["from"]>[0];

/*
 * The generated types accept only a literal union of table names, which is
 * the one guarantee a config-driven editor cannot make: the table is chosen
 * at runtime from CONTENT_TABLES. The cast is narrow and lives here alone;
 * what replaces the compiler check is that every name in CONTENT_TABLES was
 * read back off the live schema before it was written down.
 */
const named = (t: string) => t as AnyTable;

/**
 * Editing the catalogue from the admin screen.
 *
 * Six content types had no editor at all — openings, skills, career paths,
 * groups, reward offers and badges — so changing any of them meant writing SQL
 * by hand. Rather than six bespoke screens that would drift apart, each table
 * is described once here and one generic editor renders all of them. Adding a
 * seventh is a config entry, not a new page.
 *
 * WHAT IS DELIBERATELY NOT HERE. Nothing derived and nothing counted:
 * `member_count`, `usage_count`, `application_count`, `search_vector`,
 * timestamps and ids are all maintained by the database. Putting a computed
 * column in an editor invites somebody to "correct" it, and the next write
 * from the app overwrites whatever they typed.
 *
 * Money is stored in minor units — paise — everywhere in this schema. The
 * editor shows and accepts rupees and converts on the way in and out, because
 * an admin typing 2999 into a field labelled ₹ should not have to know that.
 */

export type FieldType = "text" | "textarea" | "number" | "money" | "bool" | "select" | "url";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  /** For `select`. */
  options?: string[];
  /** Shown under the input. Use it for units, limits and consequences. */
  help?: string;
  /** Blocked on create as well as edit. */
  readOnly?: boolean;
}

export interface ContentTable {
  /** Postgres table name. */
  table: string;
  /** What the tab calls it. */
  label: string;
  /** One sentence on what editing this changes for a visitor. */
  note: string;
  /** Column shown as the row's heading. */
  titleKey: string;
  /** Columns shown under the heading, in order, skipping empty ones. */
  subtitleKeys: string[];
  orderBy: string;
  ascending: boolean;
  fields: FieldSpec[];
  /** Off where a row without its related rows would be broken or invisible. */
  canCreate: boolean;
  canDelete: boolean;
}

export const CONTENT_TABLES: ContentTable[] = [
  {
    table: "opportunities",
    label: "Openings",
    note: "Jobs and internships on the opportunities pages.",
    titleKey: "title",
    subtitleKeys: ["kind", "location", "work_mode"],
    orderBy: "created_at",
    ascending: false,
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "kind", label: "Kind", type: "select", options: ["job", "internship"] },
      {
        key: "slug",
        label: "Slug",
        type: "text",
        help: "Appears in the URL. Lower case, hyphens.",
      },
      {
        key: "summary",
        label: "Summary",
        type: "textarea",
        help: "One or two lines, shown on the card.",
      },
      { key: "description", label: "Description", type: "textarea" },
      { key: "responsibilities", label: "Responsibilities", type: "textarea" },
      { key: "eligibility", label: "Who can apply", type: "textarea" },
      { key: "location", label: "Location", type: "text" },
      {
        key: "work_mode",
        label: "Work mode",
        type: "select",
        options: ["onsite", "remote", "hybrid"],
      },
      {
        key: "apply_url",
        label: "Apply link",
        type: "url",
        help: "The employer's own page. A scheduled job checks this and flags it if it stops responding.",
      },
      { key: "salary_min_minor", label: "Salary from (₹)", type: "money" },
      { key: "salary_max_minor", label: "Salary to (₹)", type: "money" },
      { key: "stipend_minor", label: "Stipend (₹)", type: "money", help: "Internships." },
      { key: "openings", label: "Positions", type: "number" },
      { key: "is_paid", label: "Paid", type: "bool" },
      {
        key: "is_published",
        label: "Published",
        type: "bool",
        help: "Unpublished rows disappear from the site immediately.",
      },
    ],
  },
  {
    table: "courses",
    label: "Courses",
    note: "Everything the course pages show, beyond the title and price on the Courses tab.",
    titleKey: "title",
    subtitleKeys: ["level", "mode", "city"],
    orderBy: "created_at",
    ascending: false,
    canCreate: false,
    canDelete: false,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "price_minor",
        label: "Price (₹)",
        type: "money",
        help: "Capped at ₹2,999 by the database.",
      },
      { key: "is_free", label: "Free", type: "bool" },
      {
        key: "level",
        label: "Level",
        type: "select",
        options: ["beginner", "intermediate", "advanced"],
      },
      { key: "mode", label: "Mode", type: "select", options: ["online", "offline", "hybrid"] },
      { key: "duration_minutes", label: "Length (minutes)", type: "number" },
      { key: "city", label: "City", type: "text" },
      { key: "cover_url", label: "Cover image", type: "url" },
      { key: "is_published", label: "Published", type: "bool" },
    ],
  },
  {
    table: "skills",
    label: "Skills",
    note: "The skill list behind courses, SkillSwap matching and career paths.",
    titleKey: "name",
    subtitleKeys: ["slug"],
    orderBy: "name",
    ascending: true,
    canCreate: true,
    canDelete: false,
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "slug", label: "Slug", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "is_approved",
        label: "Approved",
        type: "bool",
        help: "Members can suggest skills. Unapproved ones stay out of search and matching.",
      },
    ],
  },
  {
    table: "career_paths",
    label: "Career paths",
    note: "The target jobs on /careers and the readiness scoring behind them.",
    titleKey: "title",
    subtitleKeys: ["slug"],
    orderBy: "title",
    ascending: true,
    canCreate: true,
    canDelete: false,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "slug", label: "Slug", type: "text" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "icon", label: "Icon", type: "text", help: "A lucide icon name." },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    table: "communities",
    label: "Groups",
    note: "The groups people can join in the community.",
    titleKey: "name",
    subtitleKeys: ["slug"],
    orderBy: "name",
    ascending: true,
    canCreate: true,
    canDelete: false,
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "slug", label: "Slug", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "icon", label: "Icon", type: "text" },
      { key: "is_public", label: "Public", type: "bool" },
    ],
  },
  {
    table: "reward_offers",
    label: "Rewards",
    note: "What points buy on the rewards page.",
    titleKey: "title",
    subtitleKeys: ["points_cost"],
    orderBy: "points_cost",
    ascending: true,
    canCreate: true,
    canDelete: true,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "points_cost", label: "Points", type: "number" },
      {
        key: "percent_off",
        label: "Percent off",
        type: "number",
        help: "Leave empty for a flat amount.",
      },
      { key: "amount_off_minor", label: "Flat amount off (₹)", type: "money" },
      { key: "max_discount_minor", label: "Maximum discount (₹)", type: "money" },
      { key: "min_spend_minor", label: "Minimum order (₹)", type: "money" },
      { key: "valid_days", label: "Code valid for (days)", type: "number" },
      { key: "sort_order", label: "Order on the page", type: "number" },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    table: "badges",
    label: "Badges",
    note: "Badges shown on profiles and the Skill Passport.",
    titleKey: "name",
    subtitleKeys: ["tier"],
    orderBy: "name",
    ascending: true,
    canCreate: false,
    canDelete: false,
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "icon", label: "Icon", type: "text" },
      { key: "tier", label: "Tier", type: "select", options: ["bronze", "silver", "gold"] },
      {
        key: "is_active",
        label: "Active",
        type: "bool",
        help: "How a badge is earned is set in code, not here.",
      },
    ],
  },
];

export const tableByName = (name: string) => CONTENT_TABLES.find((t) => t.table === name);

export type Row = Record<string, unknown>;

/** Every field the editor touches, plus the id it needs to write back. */
function columns(spec: ContentTable): string {
  const keys = new Set<string>(["id", spec.titleKey, ...spec.subtitleKeys]);
  for (const f of spec.fields) keys.add(f.key);
  return [...keys].join(", ");
}

export async function listRows(spec: ContentTable, search = "", limit = 200): Promise<Row[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase.from(named(spec.table)).select(columns(spec));
  if (search.trim()) q = q.ilike(spec.titleKey, `%${search.trim()}%`);
  const { data, error } = await q.order(spec.orderBy, { ascending: spec.ascending }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

/**
 * Only the fields that actually changed are sent.
 *
 * Writing back every field on every save would overwrite a column somebody
 * else edited between this screen loading and the save, and would fail any
 * check constraint on a field the editor never touched.
 */
export async function updateRow(spec: ContentTable, id: string, patch: Row): Promise<void> {
  const supabase = requireSupabase();
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from(named(spec.table))
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

export async function createRow(spec: ContentTable, values: Row): Promise<void> {
  const supabase = requireSupabase();
  // Same reason as `named`: the row's shape is decided by the config, not
  // by a type the compiler can see.
  const { error } = await supabase.from(named(spec.table)).insert(values as never);
  if (error) throw new Error(friendly(error.message));
}

export async function deleteRow(spec: ContentTable, id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from(named(spec.table)).delete().eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Postgres tells the truth but not kindly.
 *
 * The two failures an administrator will actually hit are a check constraint
 * and a missing policy, and both arrive as sentences nobody can act on. The
 * policy one matters most: until db/019 has been run, every save here fails
 * with a row-level-security error that says nothing about which migration is
 * missing.
 */
function friendly(message: string): string {
  if (/row-level security|violates row-level/i.test(message)) {
    return "The database refused the change. Run db/019_admin_can_edit_content.sql, then try again.";
  }
  if (/check constraint/i.test(message)) {
    const named = /check constraint "([^"]+)"/.exec(message);
    return named
      ? `A value is outside what the database allows (${named[1]}).`
      : "A value is outside what the database allows.";
  }
  if (/duplicate key/i.test(message)) return "Something with that slug already exists.";
  if (/violates foreign key/i.test(message)) return "This row is still referenced somewhere else.";
  if (/null value in column "([^"]+)"/.test(message)) {
    const col = /null value in column "([^"]+)"/.exec(message);
    return `${col ? col[1] : "A field"} cannot be empty.`;
  }
  return message;
}

/** Minor units in the database, rupees in the editor. */
export const toRupees = (minor: unknown): string =>
  minor === null || minor === undefined || minor === "" ? "" : String(Number(minor) / 100);

export const toMinor = (rupees: string): number | null =>
  rupees.trim() === "" ? null : Math.round(Number(rupees) * 100);
