import { createFileRoute } from "@tanstack/react-router";
import { handleMembership, methodNotAllowed } from "@/membership/server/handler";

/**
 * The optional AI arranger for the Swayam Plus card.
 *
 * Profile type and coarse usage aggregates in, one validated ordering out. The rules fallback has already
 * rendered before this is called and keeps working if it never answers. The AI never sees or sets a price
 * and never picks the plan. All the logic lives in src/membership/server/handler.ts so it can be tested as a
 * plain function; this file only wires it to the router.
 */
export const Route = createFileRoute("/api/membership")({
  server: {
    handlers: {
      POST: ({ request }) => handleMembership(request),
      // Every other method (GET, HEAD, PUT, OPTIONS ...) is a 405, not the app's soft-404 page.
      ANY: () => methodNotAllowed(),
    },
  },
});
