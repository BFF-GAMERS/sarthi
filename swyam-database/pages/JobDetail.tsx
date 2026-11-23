import OpportunityDetail from "../components/OpportunityDetail";

/**
 * One job in full.
 *
 * Previously looked its posting up in `data/mock.ts`, so a real vacancy — one
 * an employer had posted, and one the listing page now shows — produced "Job
 * not found". The two halves of the product disagreed about what existed.
 */
export default function JobDetail() {
  return <OpportunityDetail kind="job" />;
}
