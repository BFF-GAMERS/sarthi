import { CalendarClock } from "lucide-react";
import { useTx } from "@/lib/i18n";
import { buildPlaybook, hidePlaybookForever } from "@/lib/swap-assist/playbook";

/**
 * A skippable 30-minute plan for the first session of a swap.
 *
 * No hooks and no state: the parent decides whether it is on screen and
 * `onClose` removes it. "Skip" only closes it. "Don't show again" also sets a
 * flag on this device so the plan is not offered automatically after the next
 * accept. Opening it by hand from a swap card (`manual`) ignores that flag
 * and has just a Close button.
 */
export default function SessionPlaybook({
  teachSkill,
  learnSkill,
  onClose,
  manual = false,
}: {
  /** The skill you teach in this swap. */
  teachSkill?: string | null;
  /** The skill you learn; null for a one-way request. */
  learnSkill?: string | null;
  onClose: () => void;
  manual?: boolean;
}) {
  const tx = useTx();
  const plan = buildPlaybook({ teachSkill, learnSkill }, tx);
  const title = tx("Your first 30 minutes together");

  return (
    <section className="swap-playbook" aria-label={title}>
      <div className="swap-playbook-head">
        <CalendarClock size={18} aria-hidden />
        <div>
          <p className="swap-playbook-kicker">{tx("Optional plan")}</p>
          <h2 className="swap-playbook-title">{title}</h2>
        </div>
      </div>
      <p className="swap-playbook-lede">
        {tx("A simple outline you can follow or ignore. Change it however suits the two of you.")}
      </p>

      <div className="swap-playbook-bar" aria-hidden>
        {plan.steps.map((s) => (
          <span key={s.id} style={{ flexGrow: s.minutes }} data-step={s.id} />
        ))}
      </div>

      <ol className="swap-playbook-steps">
        {plan.steps.map((s) => (
          <li key={s.id}>
            <span className="swap-playbook-min">
              {s.minutes} {tx("min")}
            </span>
            <div>
              <p className="swap-playbook-step">{s.title}</p>
              <p className="swap-playbook-tip">{s.tip}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="swap-playbook-actions">
        {manual ? (
          <button type="button" className="btn-ghost !px-4 !py-2 !text-xs" onClick={onClose}>
            {tx("Close")}
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost !px-4 !py-2 !text-xs" onClick={onClose}>
              {tx("Skip")}
            </button>
            <button
              type="button"
              className="swap-playbook-quiet"
              onClick={() => {
                hidePlaybookForever();
                onClose();
              }}
            >
              {tx("Don't show again")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
