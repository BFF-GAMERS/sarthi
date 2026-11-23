import Compare from "./Compare";

/**
 * /courses/compare, kept so every old link and bookmark still lands somewhere.
 * It is the same side-by-side table as /compare, fed by the course shortlist.
 */
export default function CourseCompare() {
  return <Compare forceKind="course" />;
}
