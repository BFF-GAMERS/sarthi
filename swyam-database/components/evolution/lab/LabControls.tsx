/**
 * Lab resets (plan §6): Reset Behaviour, Reset Evolution. They ask for a second click,
 * because outside a demo they act on the person's real on-device profile. The play
 * controls (simulate, replay, exit) live in PlayControls, above the fold.
 */
import { useEffect, useRef, useState } from "react";
import { resetBehaviour, resetEvolution } from "@/evolution";
import { PERSONAS } from "@/evolution/core/fixtures/journeys";
import { useEvolutionStatus } from "@/evolution/react/hooks";
import { LabPanel } from "./LabPanel";

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className="btn-ghost !px-4 !py-2 !text-[13px]"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export default function LabControls() {
  const status = useEvolutionStatus();
  return (
    <LabPanel
      id="controls"
      title="Reset"
      hint={
        status.demo
          ? `You are in the ${PERSONAS[status.demo].label} demo. Resets apply to the demo only.`
          : "Outside a demo, resets apply to your real on-device profile."
      }
    >
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          label="Reset Behavior"
          confirmLabel="Confirm: clear what was learned"
          onConfirm={resetBehaviour}
        />
        <ConfirmButton
          label="Reset Evolution"
          confirmLabel="Confirm: back to universal"
          onConfirm={resetEvolution}
        />
      </div>
    </LabPanel>
  );
}
