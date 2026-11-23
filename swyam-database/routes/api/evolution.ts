import { createFileRoute } from "@tanstack/react-router";
import { handleEvolution, methodNotAllowed } from "@/evolution/server/handler";

/**
 * The optional AI brain of the Evolution Engine.
 *
 * Aggregates in, one validated decision out. The on-device engine has already
 * decided before this is called and keeps working if it never answers. All the
 * logic lives in src/evolution/server/handler.ts so it can be tested as a
 * plain function; this file only wires it to the router.
 */
export const Route = createFileRoute("/api/evolution")({
  server: {
    handlers: {
      POST: ({ request }) => handleEvolution(request),
      // Every other method (GET, HEAD, PUT, OPTIONS ...) is a 405, not the app's soft-404 page.
      ANY: () => methodNotAllowed(),
    },
  },
});
