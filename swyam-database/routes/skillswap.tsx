import { createFileRoute } from "@tanstack/react-router";
import Page, { type SwapTab } from "@/pages/SkillSwap";

const TITLE = "SkillSwap — trade what you know for what you want to learn | स्वYAM";
const DESC =
  "Find someone who teaches what you want to learn and wants what you already know. Matched on skill fit, goals, language, availability and format.";

/**
 * `?tab=requests` is the link a swap-request notification carries. Without a
 * validator the router drops unknown search keys, so the bell would land on
 * the page but on the wrong tab — which reads as "the request is gone".
 */
export const Route = createFileRoute("/skillswap")({
  validateSearch: (search: Record<string, unknown>): { tab?: SwapTab } => {
    const tab = search["tab"];
    return tab === "matches" || tab === "requests" || tab === "swaps" ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: SkillSwapRoute,
});

function SkillSwapRoute() {
  const { tab } = Route.useSearch();
  return <Page initialTab={tab} />;
}
