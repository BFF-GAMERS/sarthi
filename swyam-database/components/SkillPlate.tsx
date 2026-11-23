import { BadgeCheck, Briefcase, Play } from "lucide-react";
import { SAMPLE_SERIAL } from "../lib/certificate";
import { useTx } from "../lib/i18n";

/**
 * The hero graphic: the product, drawn with the product's own parts.
 *
 * Three surfaces a member actually sees, stacked the way the journey runs —
 * a course part-way through, the certificate it ends in, and the opening
 * that certificate unlocks. Everything is HTML and tokens, so it recolours
 * with the interface mode and weighs nothing on a phone.
 *
 * The figures are illustrative; the composition is marked as one image for
 * assistive technology so nobody is read a fake progress bar.
 */
export default function SkillPlate({ className = "" }: { className?: string }) {
  const tx = useTx();
  const modules = [
    tx("Site safety and PPE"),
    tx("Panel mounting"),
    tx("DC wiring and inverters"),
    tx("Commissioning"),
  ];

  return (
    <div
      role="img"
      aria-label={tx(
        "Illustration: a course in progress, the verified certificate it leads to, and a job offer",
      )}
      className={`relative mx-auto aspect-[5/4.4] w-full max-w-[34rem] select-none ${className}`}
    >
      {/* The ground under the illustration, which each register paints in
          its own material: a saffron wash on near-black, deeper paper with
          a rule around it on cream. Same element, same geometry. */}
      <div
        aria-hidden
        className="absolute inset-[6%]"
        style={{
          backgroundColor: "var(--plate-ground)",
          borderRadius: "var(--plate-radius)",
          backgroundImage:
            "radial-gradient(40% 50% at 20% 20%, var(--plate-wash), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="ledger absolute inset-[6%] opacity-70"
        style={{ borderRadius: "var(--plate-radius)" }}
      />

      {/* Course card — the back layer */}
      <div className="animate-float-late absolute left-[4%] top-[8%] w-[58%] rounded-[1.4rem] border border-ink-line bg-paper-light p-4 shadow-[var(--shadow-raised)] sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron-500 text-on-accent">
            <Play size={16} fill="currentColor" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
              {tx("Solar PV installer")}
            </p>
            <p className="font-body text-[11.5px] text-ink-mute">{tx("Module 3 of 4")}</p>
          </div>
        </div>
        <ol className="mt-4 space-y-2">
          {modules.map((m, i) => (
            <li key={m} className="flex items-center gap-2.5">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                  i < 2
                    ? "bg-emeraldx-400 text-on-emerald"
                    : i === 2
                      ? "border-2 border-saffron-500 text-saffron-500"
                      : "border border-ink-line text-ink-mute"
                }`}
              >
                {i < 2 ? "✓" : ""}
              </span>
              <span
                className={`truncate font-body text-[12px] ${i <= 2 ? "text-ink" : "text-ink-mute"}`}
              >
                {m}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
          <span className="block h-full w-[68%] rounded-full bg-saffron-500" />
        </div>
      </div>

      {/* Certificate — the front layer */}
      <div className="animate-float absolute bottom-[10%] right-[2%] w-[64%] rounded-[1.4rem] border border-ink-line bg-paper-light p-4 shadow-[var(--shadow-float)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker !text-[10px]">{tx("Certificate")}</p>
            <p className="mt-1.5 font-display text-[17px] font-semibold leading-tight text-ink">
              {tx("Solar PV installer")}
            </p>
            <p className="mt-0.5 font-body text-[11.5px] text-ink-mute">{tx("NSQF level 4")}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emeraldx-400 text-on-emerald shadow-[var(--shadow-soft)]">
            <BadgeCheck size={22} aria-hidden />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-paper-dim px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-mute">
            {tx("Serial")}
          </span>
          <span className="font-mono text-[12px] font-semibold text-ink">{SAMPLE_SERIAL}</span>
        </div>
        <p className="mt-2.5 font-body text-[11px] text-emeraldx-400">
          ✓ {tx("Verifiable by any employer")}
        </p>
      </div>

      {/* The opening — a chip that floats between the two */}
      <div className="absolute right-[0%] top-[12%] hidden items-center sm:flex gap-2.5 rounded-full border border-ink-line bg-paper-light py-1.5 pl-1.5 pr-4 shadow-[var(--shadow-raised)]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper">
          <Briefcase size={14} aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block font-body text-[12px] font-semibold text-ink">
            {tx("Junior solar technician")}
          </span>
          <span className="block font-body text-[10.5px] text-ink-mute">
            {tx("Apprenticeship · Jaipur")}
          </span>
        </span>
      </div>
    </div>
  );
}
