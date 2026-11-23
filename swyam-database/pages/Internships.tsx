import OpportunityList from "../components/OpportunityList";
import JobsForYou from "../components/JobsForYou";

/** Internships — the same listing machinery as jobs, filtered to placements. */
export default function Internships() {
  return <OpportunityList kind="internship" picks={<JobsForYou next="/internships" />} />;
}
