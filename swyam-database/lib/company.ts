import { requireSupabase } from "./supabase";

/**
 * A recruiter's own company, created by them.
 *
 * Until db/024 there was no way for a new employer account to become a
 * member of anything: `company_members` can only be written by an owner or
 * admin of the company in question, which a brand-new account never is. So
 * every employer had to be added by hand at the database, and recruiter
 * onboarding could not produce a working dashboard.
 *
 * `create_company_for_me` is the narrow way in — one company per person,
 * never verified, never a platform account — and it is the only thing in the
 * app that creates a membership row.
 */
export interface NewCompany {
  name: string;
  industry?: string | null;
  headquarters?: string | null;
  website?: string | null;
}

export async function createCompanyForMe(c: NewCompany): Promise<{ id: string; slug: string }> {
  const supabase = requireSupabase();
  // `create_company_for_me` arrives with db/024, after the generated types
  // were written, so the call is made through an untyped view of the client
  // rather than by hand-editing database.ts for one function.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  const { data, error } = await rpc("create_company_for_me", {
    p_name: c.name.trim(),
    p_industry: c.industry?.trim() || undefined,
    p_headquarters: c.headquarters?.trim() || undefined,
    p_website: c.website?.trim() || undefined,
  });
  if (error) {
    if (error.code === "23505" || /already administers/i.test(error.message)) {
      throw new Error("This account already has a company.");
    }
    // The function does not exist until db/024 has been run.
    if (
      error.code === "42883" ||
      /function .* does not exist|find the function/i.test(error.message)
    ) {
      throw new Error(
        "Employer accounts are still linked by hand on this site. Write to us and we will connect yours.",
      );
    }
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; slug: string } | null;
  if (!row?.id) throw new Error("The company could not be created.");
  return { id: row.id, slug: row.slug };
}
