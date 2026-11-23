import { Bot, FlaskConical } from "lucide-react";
import { useTx } from "../lib/i18n";

/**
 * What kind of account this is, said out loud next to the name.
 *
 * The community feed has seeded content in it — sample members asking real
 * questions, and Sarthi answering. That is only defensible if a reader can
 * tell at a glance, so this badge is not decoration: it is the thing that
 * makes the seeding honest rather than a small lie told to look busy.
 *
 * It renders nothing for a real member, so it can be dropped beside any name
 * on the site without a condition around it.
 */
export default function AccountBadge({
  isDemo,
  isAi,
  className = "",
}: {
  isDemo?: boolean;
  isAi?: boolean;
  className?: string;
}) {
  const tx = useTx();

  // AI wins when both are set: "this is not a person" is the more important
  // of the two things a reader needs to know.
  if (isAi) {
    return (
      <span
        title={tx("This is the स्वYAM assistant, not a person.")}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-peacock/40 bg-peacock/10 px-1.5 py-0.5 font-body text-[10px] font-semibold uppercase leading-none tracking-wide text-peacock ${className}`}
      >
        <Bot size={10} aria-hidden />
        {tx("AI")}
      </span>
    );
  }

  if (isDemo) {
    return (
      <span
        title={tx("A sample account, here to show how the platform works.")}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-ink-line bg-paper-dim px-1.5 py-0.5 font-body text-[10px] font-semibold uppercase leading-none tracking-wide text-ink-mute ${className}`}
      >
        <FlaskConical size={10} aria-hidden />
        {tx("Demo")}
      </span>
    );
  }

  return null;
}
