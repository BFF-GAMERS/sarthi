import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Verify";
import { normaliseSerial } from "@/lib/certificate";

export const Route = createFileRoute("/verify/$serial")({
  head: ({ params }) => {
    const title = `Verify certificate ${normaliseSerial(params.serial)} — स्वYAM`;
    const desc =
      "Check whether a स्वYAM certificate serial is genuine. Open to anyone, no account needed.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: Page,
});
