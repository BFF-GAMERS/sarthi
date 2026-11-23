import { createFileRoute, redirect } from "@tanstack/react-router";
import Page from "@/pages/VerifyLookup";
import { isPlausibleSerial, normaliseSerial } from "@/lib/certificate";

/**
 * /verify — the address printed for employers.
 *
 * It was a 404: only /verify/<serial> existed. This is the page with the box
 * to type a serial into. The box is a plain GET form, so /verify?serial=… is
 * forwarded to the certificate's own address here, on the server, which keeps
 * the check working before the page's JavaScript has loaded.
 */
export const Route = createFileRoute("/verify/")({
  // The router parses search values, so ?serial=12345 arrives as a number and
  // ?serial=true as a boolean. Search params are also merged with the parent
  // route's, so returning {} would let that raw value survive the merge (see
  // auth.tsx). The key is always set explicitly: a string, or nothing.
  validateSearch: (search: Record<string, unknown>): { serial: string | undefined } => {
    const raw = search["serial"];
    const text =
      typeof raw === "string"
        ? raw
        : typeof raw === "number" || typeof raw === "boolean"
          ? String(raw)
          : "";
    return { serial: text !== "" ? text : undefined };
  },
  beforeLoad: ({ search }) => {
    const serial = typeof search.serial === "string" ? normaliseSerial(search.serial) : "";
    if (serial && isPlausibleSerial(serial)) {
      throw redirect({ to: "/verify/$serial", params: { serial } });
    }
  },
  head: () => {
    const title = "Check a certificate — स्वYAM";
    const desc =
      "Type a स्वYAM certificate serial to see whether it is genuine. Open to anyone, no account needed.";
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
