import { getSupabase } from "./supabase";
import { issuerName } from "./issuer";

/**
 * Reading somebody's published Skill Passport.
 *
 * The Passport page has always built a share URL — `${origin}/passport/${slug}`
 * — put it on screen and offered a Copy link button. No route ever served that
 * path. Every link anybody has copied and sent to an employer has opened a
 * 404, and the platform's whole claim is that its record can be checked.
 *
 * `get_shared_passport` does all the deciding: it returns `{found:false}` for
 * a passport that is not published, strips each section the owner switched
 * off, and records the view. Nothing here re-implements any of that — this is
 * a shape translation and nothing else.
 */

export interface SharedSkill {
  skillId: string;
  /** The snapshot's key is `skill`, not `name`. Getting that wrong renders blanks. */
  name: string;
  category: string | null;
  level: string | null;
  verification: string | null;
  verifiedAt: string | null;
  evidenceCount: number;
}

export interface SharedCertificate {
  serial: string;
  title: string;
  issuer: string | null;
  issuedAt: string | null;
  score: number | null;
  revoked: boolean;
}

export interface SharedCourse {
  title: string;
  state: string;
  progress: number;
  completedAt: string | null;
}

export interface SharedPassport {
  found: boolean;
  headline: string | null;
  summary: string | null;
  name: string;
  handle: string | null;
  region: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** Absent when the owner has switched that whole section off. */
  skills: SharedSkill[] | null;
  certificates: SharedCertificate[] | null;
  courses: SharedCourse[] | null;
  generatedAt: string | null;
}

interface RawSnapshot {
  found?: boolean;
  headline?: string | null;
  summary?: string | null;
  passport?: {
    generated_at?: string;
    profile?: {
      display_name?: string;
      handle?: string;
      region?: string | null;
      avatar_url?: string | null;
      bio?: string | null;
    };
    skills?: Array<{
      skill_id?: string;
      skill?: string;
      category?: string | null;
      level?: string | null;
      verification?: string | null;
      verified_at?: string | null;
      evidence_count?: number;
    }>;
    certificates?: Array<{
      serial?: string;
      title?: string;
      issuer?: string | null;
      issued_at?: string | null;
      score?: number | null;
      revoked?: boolean;
    }>;
    courses?: Array<{
      title?: string;
      state?: string;
      progress?: number;
      completed_at?: string | null;
    }>;
  };
}

const NOT_FOUND: SharedPassport = {
  found: false,
  headline: null,
  summary: null,
  name: "",
  handle: null,
  region: null,
  avatarUrl: null,
  bio: null,
  skills: null,
  certificates: null,
  courses: null,
  generatedAt: null,
};

/**
 * `source` separates a link somebody opened from a card embedded on a blog,
 * so the owner's view count means two different things it can tell apart.
 */
export async function getSharedPassport(
  slug: string,
  source: "link" | "embed" = "link",
): Promise<SharedPassport> {
  const supabase = getSupabase();
  if (!supabase) return NOT_FOUND;

  const { data, error } = await supabase.rpc("get_shared_passport", {
    p_slug: slug,
    p_source: source,
  });
  if (error) throw new Error(error.message);

  const raw = data as unknown as RawSnapshot | null;
  if (!raw?.found) return NOT_FOUND;

  const p = raw.passport ?? {};
  const profile = p.profile ?? {};

  return {
    found: true,
    headline: raw.headline ?? null,
    summary: raw.summary ?? null,
    name: profile.display_name ?? "Member",
    handle: profile.handle ?? null,
    region: profile.region ?? null,
    avatarUrl: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    // A missing key and an empty array mean different things here: the first
    // is "the owner switched this section off", the second is "there is
    // nothing in it yet". Rendering both as an empty list would tell a reader
    // somebody has no certificates when they have simply hidden them.
    skills: p.skills
      ? p.skills.map((s) => ({
          skillId: s.skill_id ?? "",
          name: s.skill ?? "",
          category: s.category ?? null,
          level: s.level ?? null,
          verification: s.verification ?? null,
          verifiedAt: s.verified_at ?? null,
          evidenceCount: s.evidence_count ?? 0,
        }))
      : null,
    certificates: p.certificates
      ? p.certificates.map((c) => ({
          serial: c.serial ?? "",
          title: c.title ?? "",
          issuer: issuerName(c.issuer),
          issuedAt: c.issued_at ?? null,
          score: c.score ?? null,
          revoked: c.revoked === true,
        }))
      : null,
    courses: p.courses
      ? p.courses.map((c) => ({
          title: c.title ?? "",
          state: c.state ?? "",
          progress: c.progress ?? 0,
          completedAt: c.completed_at ?? null,
        }))
      : null,
    generatedAt: p.generated_at ?? null,
  };
}
