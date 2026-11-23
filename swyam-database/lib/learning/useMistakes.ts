import { useCallback, useEffect, useState } from "react";
import {
  loadMistakes,
  MISTAKES_EVENT,
  remindersOn,
  setRemindersOn,
  type MistakeItem,
} from "./mistakes";

/** The scope's notebook, kept in step with other tabs and with this tab's writes. */
export function useMistakes(scope: string): MistakeItem[] {
  const [items, setItems] = useState<MistakeItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(loadMistakes(scope));
    sync();
    window.addEventListener(MISTAKES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MISTAKES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [scope]);
  return items;
}

/** Opt-in reminder chip. Default off. */
export function useReminders(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(remindersOn());
    sync();
    window.addEventListener(MISTAKES_EVENT, sync);
    return () => window.removeEventListener(MISTAKES_EVENT, sync);
  }, []);
  const set = useCallback((v: boolean) => setRemindersOn(v), []);
  return [on, set];
}
