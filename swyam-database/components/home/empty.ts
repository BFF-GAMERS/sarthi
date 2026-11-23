import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import type { SectionId } from "@/evolution/types";
import { listEnrollments } from "@/lib/profile-data";
import { useEvolutionSnapshot } from "@/evolution/react/hooks";
import { useIntentLane, useRecentViews } from "./data";

/**
 * The sections that would render nothing right now. Three Home sections hide themselves when they
 * have nothing real to show (Recently viewed, Continue learning, Intent Lane). The flat grid has to know that
 * before it places anything, otherwise a lone neighbour would sit in the right-hand column with a
 * hole beside it. The tests here must stay in step with those components. Both read stores that
 * are empty on the server, so the first render agrees with the server markup.
 */
export function useEmptySections(signedIn: boolean): ReadonlySet<SectionId> {
  const { profileId } = useAuth();
  // Same key and query as the Continue learning section, so React Query serves one request.
  const enrolments = useQuery({
    queryKey: ["enrollments", profileId],
    queryFn: () => listEnrollments(profileId!),
    enabled: Boolean(profileId),
  });
  const views = useRecentViews();
  const enrolled = enrolments.data;
  const layout = useEvolutionSnapshot().ui.layout;
  const lane = useIntentLane(signedIn, layout);
  const laneEmpty = lane.status === "empty";

  return useMemo(() => {
    const empty = new Set<SectionId>();
    if (views.length === 0) empty.add("RECENTLY_VIEWED");
    const inProgress = (enrolled ?? []).some(
      (e) => e.state !== "cancelled" && e.progressPercent < 100,
    );
    const viewedCourse = views.some((v) => v.kind === "course");
    if (!(signedIn ? inProgress : viewedCourse)) empty.add("CONTINUE_LEARNING");
    // The Intent Lane stays out of the standard and discovery layouts until two skills repeat; in the
    // evolved layouts it renders its own explanation, so it is never counted as empty there.
    if (laneEmpty && (layout === "UNIVERSAL" || layout === "DISCOVERY")) empty.add("INTENT_LANE");
    return empty;
  }, [signedIn, views, enrolled, laneEmpty, layout]);
}
