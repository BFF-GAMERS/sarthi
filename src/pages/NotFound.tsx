import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="kicker">404</p>
        <h1 className="type-xl mt-3">Page not found</h1>
        <p className="mt-4 text-ink-soft">
          The page you are looking for may have moved, or the link may be broken.
        </p>
        <div className="card mt-8 p-6">
          <p>Let's get you back on track.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/" className="btn-primary">
              Back to home
            </Link>
            <Link to="/courses" className="btn-ghost">
              Browse courses
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
