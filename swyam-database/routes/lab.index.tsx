import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Page = lazy(() => import("@/pages/EvolutionLab"));
const TITLE = "Evolution Lab — how स्वYAM adapts to you";
const DESC =
  "See what स्वYAM has learned from how you use it, how its structure changed, and reset it any time.";

export const Route = createFileRoute("/lab/")({
  // /lab?play=career starts that persona on arrival (the page resolves aliases and unknown values).
  validateSearch: (search: Record<string, unknown>): { play?: string } =>
    typeof search["play"] === "string" && search["play"].length <= 40
      ? { play: search["play"] }
      : {},
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LabRoute,
});

function LabRoute() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
