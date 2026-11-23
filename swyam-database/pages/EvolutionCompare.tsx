/**
 * /lab/compare: two personas side by side in same-origin iframes (plan §6.2).
 * The judging moment: the same Swayam, structurally different. The page itself runs
 * inside <TrackingScope disabled>, and the preview frames are read-only. Each frame scrolls
 * to the first Home section where the two differ, and "What differs" lists the rest.
 */
import { Link } from "@tanstack/react-router";
import CompareFrames from "@/components/evolution/lab/CompareFrames";
import { TrackingScope } from "@/evolution/runtime/tracker/TrackingScope";

export default function EvolutionCompare() {
  return (
    <TrackingScope disabled>
      <section className="container-x pb-24 pt-28" data-evo-compare>
        <p className="datum">Evolution Lab</p>
        <h1 className="section-title mt-3">Two people, two versions of स्वYAM</h1>
        <p className="mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-ink-soft">
          The same app, the same design, a different arrangement. Each frame is the real स्वYAM
          after a short journey, scrolled to where the two first differ. Nothing in them is saved,
          and nothing is tracked.
        </p>
        <p className="mt-3 font-body text-[13.5px] font-semibold">
          <Link to="/lab" className="text-saffron-700 underline-offset-2 hover:underline">
            Back to the Lab
          </Link>
        </p>
        <div className="mt-8">
          <CompareFrames />
        </div>
      </section>
    </TrackingScope>
  );
}
