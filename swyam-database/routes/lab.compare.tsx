import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() => import("@/pages/EvolutionCompare"));
const TITLE = "Two people, two Swayams — Evolution Lab";
const DESC = "Two personas side by side: the same स्वYAM, structurally different.";

export const Route = createFileRoute("/lab/compare")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompareRoute,
});

function CompareRoute() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
