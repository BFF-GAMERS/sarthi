/**
 * <TrackingScope disabled> — nothing inside trains the engine (the Lab, plan §6).
 * Owned by the tracker lane after contracts.
 */
import { useEffect, type ReactNode } from "react";
import { suspendTracking } from "./track";

export function TrackingScope({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  useEffect(() => (disabled ? suspendTracking() : undefined), [disabled]);
  return <>{children}</>;
}
