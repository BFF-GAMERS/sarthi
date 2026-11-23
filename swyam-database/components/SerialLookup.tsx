import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { normaliseSerial, serialProblem } from "../lib/certificate";
import { useTx } from "../lib/i18n";

/**
 * Type a serial, find out whether it is genuine.
 *
 * Underneath it is a plain GET form to /verify, so it still works on a slow
 * phone before the page's JavaScript has arrived: the /verify route turns
 * ?serial= into the certificate's own address on the server. Once the script
 * is running, the same submit becomes a client-side navigation instead.
 */
export function SerialLookup({
  initial = "",
  initialProblem = null,
}: {
  initial?: string;
  initialProblem?: string | null;
}) {
  const tx = useTx();
  const navigate = useNavigate();
  const id = useId();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | null>(initialProblem);

  return (
    <form
      action="/verify"
      method="get"
      role="search"
      aria-label={tx("Check a certificate")}
      onSubmit={(e) => {
        e.preventDefault();
        const trouble = serialProblem(value, tx);
        setProblem(trouble);
        if (trouble) return;
        void navigate({ to: "/verify/$serial", params: { serial: normaliseSerial(value) } });
      }}
    >
      <label htmlFor={`${id}-serial`} className="sr-only">
        {tx("Certificate serial")}
      </label>
      {/* The input drops its own outline, so the box shows focus instead. */}
      <div className="glass flex items-center gap-3 rounded-2xl p-2 pl-5 focus-within:ring-2 focus-within:ring-saffron-500">
        <ShieldCheck size={20} className="shrink-0 text-saffron-500" aria-hidden />
        <input
          id={`${id}-serial`}
          name="serial"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem) setProblem(null);
          }}
          placeholder={tx("Serial from the certificate")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          className="min-w-0 flex-1 bg-transparent py-3 font-mono text-lg uppercase tracking-wide text-ink placeholder-ink-mute outline-none placeholder:normal-case placeholder:tracking-normal"
        />
        <button type="submit" className="btn-primary !px-5 !py-2.5">
          {tx("Check")}
        </button>
      </div>
      {problem && (
        <p id={`${id}-problem`} role="alert" className="mt-2 font-body text-sm text-saffron-700">
          {problem}
        </p>
      )}
    </form>
  );
}
