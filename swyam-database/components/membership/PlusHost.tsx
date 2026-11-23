import { lazy, Suspense, useEffect, useState } from "react";
import { usePlusOpen } from "@/membership/trigger/plus-open-store";
import { usePlusTrigger } from "@/membership/trigger/use-plus-trigger";

const PlusSheet = lazy(() => import("./PlusSheet"));

/**
 * The always-mounted half of Swayam Plus, a few hundred bytes: it runs the trigger (which only ever
 * watches and decides) and pulls in the sheet, the foil card and the price roll the first time anything
 * asks for them. The Settings card and the Lab open the same sheet through the same store.
 */
export default function PlusHost() {
  usePlusTrigger();
  const { open } = usePlusOpen();
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (open) setWanted(true);
  }, [open]);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <PlusSheet />
    </Suspense>
  );
}
