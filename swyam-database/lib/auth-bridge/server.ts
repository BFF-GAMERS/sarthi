/**
 * Firebase login → Supabase session (the server half of the auth bridge).
 *
 * People sign in with Firebase Authentication (Google, email + password). Every row in the
 * database, every RLS policy and every function is keyed to a Supabase user id (a uuid, read
 * with auth.uid()), and Firebase ids are not uuids. So the browser hands its Firebase ID token
 * to POST /api/auth/exchange and gets back a Supabase access token for the matching member:
 *
 *   1. The Firebase token is verified here (Google's public keys, this Firebase project).
 *   2. The member's Supabase id is found or made:
 *        - uuid v5 of the Firebase uid, stable forever for that Firebase account;
 *        - or, the first time a VERIFIED email matches a member who already exists (restored
 *          from a backup, or made before the bridge), that member's id, so their data follows.
 *          An unverified email never takes over an existing account.
 *   3. The Supabase auth user is created on first sign-in (handle_new_user makes the profile).
 *   4. A short-lived access token is signed with the project's legacy JWT secret, which
 *      Supabase still trusts, carrying exactly the claims its own tokens carry.
 *
 * Needs (server only, never VITE_): SUPABASE_JWT_SECRET, SUPABASE_SECRET_KEY,
 * plus VITE_FIREBASE_PROJECT_ID and VITE_SUPABASE_URL.
 */
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

/** Fixed namespace for uuid v5: the same Firebase uid always maps to the same member id. */
const NAMESPACE = "6f1c2b8e-5d3a-4c7e-9b1f-2a8d4e6c0b57";

export function bridgeConfigured(): boolean {
  return Boolean(
    process.env["SUPABASE_JWT_SECRET"] &&
    process.env["SUPABASE_SECRET_KEY"] &&
    process.env["VITE_FIREBASE_PROJECT_ID"] &&
    process.env["VITE_SUPABASE_URL"],
  );
}

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  provider: string;
  exp: number;
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseIdentity> {
  const project = process.env["VITE_FIREBASE_PROJECT_ID"]!;
  const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
    issuer: `https://securetoken.google.com/${project}`,
    audience: project,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("token has no subject");
  const fb = (payload["firebase"] ?? {}) as { sign_in_provider?: string };
  return {
    uid: payload.sub,
    email: typeof payload["email"] === "string" ? payload["email"].toLowerCase() : null,
    emailVerified: payload["email_verified"] === true,
    name: typeof payload["name"] === "string" ? payload["name"] : null,
    picture: typeof payload["picture"] === "string" ? payload["picture"] : null,
    provider: fb.sign_in_provider ?? "password",
    exp: Number(payload.exp ?? 0),
  };
}

/** RFC 4122 version-5 uuid (SHA-1 of namespace + name). */
export async function uuidV5(name: string, namespace = NAMESPACE): Promise<string> {
  const ns = Uint8Array.from(
    namespace
      .replace(/-/g, "")
      .match(/../g)!
      .map((h) => parseInt(h, 16)),
  );
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let adminClient: SupabaseClient | null = null;
function admin(): SupabaseClient {
  adminClient ??= createClient(
    process.env["VITE_SUPABASE_URL"]!,
    process.env["SUPABASE_SECRET_KEY"]!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  return adminClient;
}

export interface MemberUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at: string | null;
  email_confirmed_at: string | null;
}

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Finds or creates the Supabase member for this Firebase identity. */
export async function memberFor(
  who: FirebaseIdentity,
  extra: { display_name?: string; handle?: string } = {},
): Promise<MemberUser> {
  const db = admin();
  const own = await uuidV5(who.uid);

  const byId = await db.auth.admin.getUserById(own);
  if (byId.data.user) return shape(byId.data.user);

  if (who.email) {
    const { data: existing, error } = await db.rpc("auth_user_id_by_email", { p_email: who.email });
    if (error) throw new Error(error.message);
    if (existing) {
      // Google and verified email/password accounts prove the mailbox; nothing else may claim it.
      if (!who.emailVerified)
        throw new BridgeError(
          "An account with this email already exists. Verify your email (check your inbox), or sign in with Google.",
          409,
        );
      const found = await db.auth.admin.getUserById(String(existing));
      if (found.data.user) return shape(found.data.user);
    }
  }

  const display = (extra.display_name ?? who.name ?? "").trim().slice(0, 80);
  const handle = (extra.handle ?? "").trim().toLowerCase().slice(0, 30);
  const created = await db.auth.admin.createUser({
    id: own,
    email: who.email ?? undefined,
    email_confirm: true,
    user_metadata: {
      ...(display ? { display_name: display, full_name: display } : {}),
      ...(handle ? { handle } : {}),
      ...(who.picture ? { avatar_url: who.picture } : {}),
      firebase_uid: who.uid,
    },
    app_metadata: { provider: who.provider === "google.com" ? "google" : "email" },
  });
  if (created.error || !created.data.user)
    throw new Error(created.error?.message ?? "could not create the member");
  return shape(created.data.user);
}

function shape(u: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  email_confirmed_at?: string | null;
}): MemberUser {
  return {
    id: u.id,
    email: u.email ?? null,
    user_metadata: u.user_metadata ?? {},
    app_metadata: u.app_metadata ?? {},
    created_at: u.created_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  };
}

/** A Supabase access token for this member: the claims GoTrue itself puts in one. */
export async function supabaseTokenFor(
  user: MemberUser,
  firebaseExp: number,
): Promise<{ access_token: string; expires_at: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expires_at = Math.min(now + 3600, firebaseExp || now + 3600);
  const access_token = await new SignJWT({
    role: "authenticated",
    email: user.email ?? "",
    phone: "",
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    aal: "aal1",
    amr: [{ method: "oauth", timestamp: now }],
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setAudience("authenticated")
    .setIssuer(`${process.env["VITE_SUPABASE_URL"]}/auth/v1`)
    .setIssuedAt(now)
    .setExpirationTime(expires_at)
    .sign(new TextEncoder().encode(process.env["SUPABASE_JWT_SECRET"]!));
  return { access_token, expires_at };
}

/**
 * The member behind a Supabase access token sent to one of our own API routes.
 * Checked locally (signature, audience, expiry), no network call.
 */
export async function memberIdFromAccessToken(token: string): Promise<string | null> {
  const secret = process.env["SUPABASE_JWT_SECRET"];
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      audience: "authenticated",
      algorithms: ["HS256"],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
