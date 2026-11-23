import { createFileRoute } from "@tanstack/react-router";
import { handleVoiceTool, methodNotAllowed } from "@/lib/voice-tool/handler";

/**
 * Sarthi's phone tool: the Sarvam voice agent's API Tool endpoint.
 *
 * Course search, enrolment and progress for the caller whose number (Sarvam's User
 * Identifier) is saved on their स्वYAM account. All the logic is in
 * src/lib/voice-tool/handler.ts and public.voice_tool (db/027); this only wires it up.
 */
export const Route = createFileRoute("/api/voice-tool")({
  server: {
    handlers: {
      POST: ({ request }) => handleVoiceTool(request),
      ANY: () => methodNotAllowed(),
    },
  },
});
