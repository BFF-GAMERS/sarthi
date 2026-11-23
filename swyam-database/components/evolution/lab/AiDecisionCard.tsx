/**
 * The AI's side of the decision (plan §6): last trigger, the validated decision as
 * safe JSON TEXT (never HTML), the validation and merge outcome, the fallback, the
 * checks left today, and "Run AI analysis". The AI is optional: when it is off the
 * card says so plainly, and the on-device engine has already decided.
 */
import { useState } from "react";
import { requestAiAnalysis } from "@/evolution/runtime/evolution/ai-scheduler";
import { useAiStatus } from "@/evolution/react/hooks";
import { getRuntime } from "@/evolution/state/commands";
import type { AiFallback } from "@/evolution/types";
import { AI_OFF_COPY, formatDecision, outcomeText } from "./labModel";
import { Chip, LabPanel } from "./LabPanel";

const FALLBACK_COPY: Record<AiFallback, string> = {
  unconfigured: "AI is not set up here",
  rate_limited: "Daily AI limit reached",
  timeout: "AI took too long",
  invalid: "AI answer did not pass validation",
  upstream: "AI service did not answer",
  off: "AI is switched off",
};

export default function AiDecisionCard() {
  const ai = useAiStatus();
  const [asking, setAsking] = useState(false);
  const busy = asking || ai.kind === "pending";
  const json = formatDecision(ai);

  const run = async () => {
    setAsking(true);
    try {
      await requestAiAnalysis(getRuntime(), "lab");
    } catch {
      /* requestAiAnalysis never rejects; belt and braces so the Lab cannot break. */
    } finally {
      setAsking(false);
    }
  };

  return (
    <LabPanel
      id="ai"
      title="AI decision"
      hint="Optional. The AI only suggests; every suggestion is validated and the layout is always built on this device."
      right={<Chip tone={ai.kind === "applied" ? "key" : "plain"}>{ai.kind}</Chip>}
    >
      {ai.kind === "unavailable" ? (
        <p className="font-body text-[14px] font-semibold text-ink" data-lab="ai-off">
          {AI_OFF_COPY}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-x-6 gap-y-2.5 font-body text-[13.5px] sm:grid-cols-2">
        <Row label="Last trigger" value={ai.lastTrigger ?? "none yet"} />
        <Row label="Outcome" value={outcomeText(ai)} />
        <Row label="Fallback" value={ai.fallback ? FALLBACK_COPY[ai.fallback] : "none"} />
        <Row label="AI checks left today" value={String(ai.callsLeftToday)} />
      </dl>

      <div className="mt-4">
        <p className="text-[11.5px] uppercase tracking-wide text-ink-mute">Decision (JSON)</p>
        {json ? (
          <pre
            className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-control)] bg-paper-deep p-3 font-mono text-[12px] leading-relaxed text-ink"
            data-lab="ai-json"
          >
            {json}
          </pre>
        ) : (
          <p className="mt-1 font-body text-[13px] text-ink-soft">
            No AI decision to show. The on-device engine decided.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        className="btn-primary mt-4 !py-2.5 !text-[13px]"
      >
        {busy ? "Asking the AI…" : "Run AI analysis"}
      </button>
    </LabPanel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] uppercase tracking-wide text-ink-mute">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{value}</dd>
    </div>
  );
}
