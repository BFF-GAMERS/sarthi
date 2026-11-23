import HomeRenderer from "../components/home/HomeRenderer";

/**
 * The landing page. What it shows and in what order is decided by the compiled
 * evolution plan (src/evolution); the sections themselves live in
 * src/components/home/sections. With no behaviour recorded the plan is the
 * universal one, so a first-time visitor sees the page as it always was.
 */
export default function Home() {
  return <HomeRenderer />;
}
