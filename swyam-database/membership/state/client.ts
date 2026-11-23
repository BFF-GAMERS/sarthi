/**
 * The browser side of POST /api/membership. It sends exactly the five-key ChooserInput (no age, no free text,
 * no price, no id) and validates whatever comes back again before anyone sees it. It never throws: every
 * failure is a `{ ok: false, reason }` and the caller keeps the rules fallback it already rendered.
 */
import { isAiEnabled, validateChoice } from "../core/chooser";
import type { ChooserInput, MembershipResponse, PlanChoice } from "../core/types";

export const MEMBERSHIP_ENDPOINT = "/api/membership";
const TIMEOUT_MS = 8_000;

export type ChoiceRequestResult =
  { ok: true; choice: PlanChoice } | { ok: false; reason: string; field?: string };

/** The client half of the kill switch (`VITE_MEMBERSHIP_AI=off`). */
export function clientAiEnabled(): boolean {
  let raw: string | undefined;
  try {
    raw = import.meta.env["VITE_MEMBERSHIP_AI"] as string | undefined;
  } catch {
    raw = undefined;
  }
  return isAiEnabled(raw);
}

export async function requestChoice(
  input: ChooserInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ChoiceRequestResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(MEMBERSHIP_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: ctl.signal,
      body: JSON.stringify({
        profileType: input.profileType,
        state: input.state,
        mode: input.mode,
        tier: input.tier,
        domains: input.domains,
      }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const body = (await res.json()) as MembershipResponse;
    if (!body || typeof body !== "object") return { ok: false, reason: "invalid" };
    if (body.ok !== true)
      return { ok: false, reason: typeof body.fallback === "string" ? body.fallback : "invalid" };
    const checked = validateChoice(body.choice, input.profileType);
    return checked.ok
      ? { ok: true, choice: checked.value }
      : { ok: false, reason: "rejected", field: checked.field };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
