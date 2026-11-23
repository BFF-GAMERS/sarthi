import { Link } from "react-router-dom";

/** Shared "course not found" block, used by the course catalog and the course player. */
export default function CourseNotFound() {
  return (
    <section className="container-x py-12" role="alert">
      <p className="type-lg">Course not found.</p>
      <Link to="/courses" className="btn-text mt-4 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-saffron-500)]">
        ← All courses
      </Link>
    </section>
  );
}
