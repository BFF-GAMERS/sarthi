/**
 * `profiles.is_minor` for the signed-in member, read once and shared. Null means "not known yet",
 * and everything that matters treats null exactly like a minor: no automatic popup, guardian wording.
 * The only age-related fact Plus ever reads, and only ever to stay quiet or to ask a guardian.
 */
import { useEffect, useState } from "react";
import { fetchIsMinor } from "@/evolution/sync/supabase-sync";

const cache = new Map<string, boolean>();

export function useIsMinor(profileId: string | null): boolean | null {
  const [value, setValue] = useState<boolean | null>(() =>
    profileId ? (cache.get(profileId) ?? null) : null,
  );

  useEffect(() => {
    if (!profileId) {
      setValue(null);
      return;
    }
    const hit = cache.get(profileId);
    if (hit !== undefined) {
      setValue(hit);
      return;
    }
    let live = true;
    void fetchIsMinor(profileId).then((v) => {
      if (v !== null) cache.set(profileId, v);
      if (live) setValue(v);
    });
    return () => {
      live = false;
    };
  }, [profileId]);

  return value;
}
