import { createFileRoute } from "@tanstack/react-router";
import { handleIntent, methodNotAllowed } from "@/lib/intent/handler";

/**
 * "Say it" fallback: a short typed phrase in, one allowlisted destination out.
 *
 * Only reached when the on-device keyword matcher found nothing. All the logic is in src/lib/intent/handler.ts
 * so it can be tested as a plain function; this file only wires it to the router.
 */
export const Route = createFileRoute("/api/intent")({
  server: {
    handlers: {
      POST: ({ request }) => handleIntent(request),
      // Every other method is a 405, not the app's soft-404 page.
      ANY: () => methodNotAllowed(),
    },
  },
});
