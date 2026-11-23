/**
 * Strict input validation for POST /api/membership (docs/evolution/subscriptions.md §2).
 *
 * The request is the profile type plus engine aggregates: five known keys, every enum from the evolution
 * config, every number finite and in range. Unknown keys are refused rather than dropped: a client that sends
 * an age, a name, free text or a price is a bug (or an attack) and must hear about it, not be trimmed.
 * Domain affinities are rounded to one decimal here too, so the model only ever sees coarse numbers.
 */
import { BEHAVIOUR_MODES, DOMAIN_IDS, EVOLUTION_STATES, TIERS } from "../../evolution/config/ids";
import { isPlanProfileType, roundDomain } from "../core/chooser";
import type { ChooserInput } from "../core/types";

/** A real request is about 200 bytes; this only stops someone posting a megabyte. */
export const MAX_BODY_BYTES = 1_000;

const KEYS = ["profileType", "state", "mode", "tier", "domains"] as const;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseChooserRequest(
  raw: unknown,
): { ok: true; value: ChooserInput } | { ok: false } {
  const no = { ok: false } as const;
  if (!isPlain(raw)) return no;
  const keys = Object.keys(raw);
  if (keys.length !== KEYS.length || !KEYS.every((k) => k in raw)) return no;

  const { profileType, state, mode, tier, domains } = raw;
  if (!isPlanProfileType(profileType)) return no;
  if (typeof state !== "string" || !(EVOLUTION_STATES as readonly string[]).includes(state))
    return no;
  if (typeof mode !== "string" || !(BEHAVIOUR_MODES as readonly string[]).includes(mode)) return no;
  if (typeof tier !== "number" || !(TIERS as readonly number[]).includes(tier)) return no;
  if (!isPlain(domains)) return no;
  const dk = Object.keys(domains);
  if (dk.length !== DOMAIN_IDS.length || !DOMAIN_IDS.every((d) => d in domains)) return no;
  for (const d of DOMAIN_IDS) {
    const v = domains[d];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return no;
  }

  return {
    ok: true,
    value: {
      profileType,
      state: state as ChooserInput["state"],
      mode: mode as ChooserInput["mode"],
      tier: tier as ChooserInput["tier"],
      domains: {
        LEARNING: roundDomain(domains["LEARNING"]),
        CAREER: roundDomain(domains["CAREER"]),
        SKILL_EXCHANGE: roundDomain(domains["SKILL_EXCHANGE"]),
        COMMUNITY: roundDomain(domains["COMMUNITY"]),
      },
    },
  };
}
