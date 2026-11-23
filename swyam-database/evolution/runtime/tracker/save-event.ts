/** One place that maps a saved item's kind to its event: course -> course_saved, job/internship -> *_saved. Other kinds are not tracked. */
import { EV } from "../../config/ids";
import { entityId } from "./entity";
import { track } from "./track";

export function trackSaved(kind: string | undefined, slug: string | undefined): void {
  if (kind === "course") track(EV.COURSE_SAVED, {}, { entityId: entityId("crs", slug) });
  else if (kind === "job") track(EV.JOB_SAVED, {}, { entityId: entityId("opp", slug) });
  else if (kind === "internship")
    track(EV.INTERNSHIP_SAVED, {}, { entityId: entityId("opp", slug) });
}
