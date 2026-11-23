import { useEffect, useState, useSyncExternalStore } from "react";
import { getPack, usePacks, type StoredPack } from "./store";

export { usePacks } from "./store";

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * `navigator.onLine`, live. True on the server and for the first client render,
 * so a page never claims to be offline before the browser has said so.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The full downloaded pack for one course, or null.
 *
 * `loading` is true until it is known whether there is one, so a page that
 * wants to serve from the pack does not first flash an error.
 */
export function usePack(courseSlug: string): { pack: StoredPack | null; loading: boolean } {
  const { packs, ready } = usePacks();
  const savedAt = packs.find((p) => p.courseSlug === courseSlug)?.savedAt ?? null;
  const [pack, setPack] = useState<StoredPack | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (savedAt === null) {
      setPack(null);
      setSettled(true);
      return;
    }
    let stale = false;
    setSettled(false);
    void getPack(courseSlug).then((p) => {
      if (stale) return;
      setPack(p);
      setSettled(true);
    });
    return () => {
      stale = true;
    };
  }, [courseSlug, ready, savedAt]);

  const hasMeta = savedAt !== null;
  return {
    pack: hasMeta && pack?.courseSlug === courseSlug ? pack : null,
    loading: !ready || (hasMeta && !settled),
  };
}
