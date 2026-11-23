import OpportunityList from "../components/OpportunityList";
import ExternalJobs from "../components/ExternalJobs";
import JobsForYou from "../components/JobsForYou";

/**
 * Jobs.
 *
 * This used to filter a hard-coded array in `data/mock.ts`, which meant the
 * openings a visitor browsed and the openings the platform actually held were
 * two different lists that happened to look alike. Applying to one wrote a row
 * against an opportunity id that did not exist.
 *
 * The list, the filters and the empty state now live in one component shared
 * with internships, because the two pages had already drifted apart.
 */
export default function Jobs() {
  return (
    <>
      <OpportunityList kind="job" picks={<JobsForYou next="/jobs" />} />
      {/* Somebody else's listings, in a section of their own, below ours.
          Draws nothing unless the feed is configured and answering. */}
      <div className="container-x pb-20">
        <ExternalJobs />
      </div>
    </>
  );
}
