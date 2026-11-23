/** Entity ids are public slugs only (`crs_python-basics`, `opp_<uuid>`, `ext_adzuna:987`). Never a person's id, handle or free text. */
import { ENTITY_ID_RE } from "../../config/ids";
import type { EntityId, EntityPrefix } from "../../types";

/** Builds a sanitiser-safe entity id (lowercased, charset-normalised, ≤64), or null when nothing usable remains. */
export function entityId(prefix: EntityPrefix, raw: unknown): EntityId | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let s = String(raw);
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep the raw text */
  }
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const id = `${prefix}_${slug}`;
  return slug && ENTITY_ID_RE.test(id) ? (id as EntityId) : null;
}
