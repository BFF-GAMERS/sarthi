/** The persona currently streaming into the sandbox, or null (reactive). */
import { useSyncExternalStore } from "react";
import { getRunningPersona, subscribePersonaRun } from "@/evolution/runtime/evolution/sandbox";
import type { PersonaId } from "@/evolution/types";

const server = (): PersonaId | null => null;

export function useRunningPersona(): PersonaId | null {
  return useSyncExternalStore(subscribePersonaRun, getRunningPersona, server);
}
