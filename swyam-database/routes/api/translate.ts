import { createFileRoute } from "@tanstack/react-router";
import { handleTranslate, methodNotAllowed } from "@/lib/translate/handler";

/** Page text into another language. All the logic is in src/lib/translate/handler.ts. */
export const Route = createFileRoute("/api/translate")({
  server: {
    handlers: {
      POST: ({ request }) => handleTranslate(request),
      ANY: () => methodNotAllowed(),
    },
  },
});
