import { useTx } from "../../lib/i18n";

const identity = (english: string) => english;

/**
 * `useTx()` that falls back to English when there is no preferences provider (a server render of Settings in a
 * test, an isolated preview). The throw happens at the same point on every render of a given tree, so the hook
 * order never changes for a mounted component.
 */
export function useSafeTx(): (english: string) => string {
  try {
    return useTx();
  } catch {
    return identity;
  }
}
