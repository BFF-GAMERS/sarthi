import { useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "../../context/PreferencesContext";
import { useTx } from "../../lib/i18n";

/**
 * Gen Z / Millennial as one segmented control (nav menu and Settings).
 *
 * The two registers of the same product, named for what they are: Gen Z is the dark street-poster
 * look, Millennial the warm paper one. Until someone picks, the device's own setting decides, and
 * the segment for that register shows as selected. Nothing is chosen for the person, and never from
 * who they are. Each segment is a 44 px target; arrow keys move the choice like a native radio group.
 */
const OPTIONS: ReadonlyArray<{ id: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { id: "dark", label: "Gen Z", Icon: Moon },
  { id: "light", label: "Millennial", Icon: Sun },
];

export default function ThemeControl({ className = "" }: { className?: string }) {
  const tx = useTx();
  const { choice: picked, mode, setChoice } = useTheme();
  // "system" is not offered any more; it shows as whichever register it resolved to.
  const choice: ThemeChoice = picked === "system" ? (mode === "genz" ? "dark" : "light") : picked;
  const group = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const i = OPTIONS.findIndex((o) => o.id === choice);
    const next = OPTIONS[(i + step + OPTIONS.length) % OPTIONS.length]!;
    setChoice(next.id);
    group.current?.querySelector<HTMLElement>(`[data-theme-choice="${next.id}"]`)?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={tx("Theme")}
      onKeyDown={onKeyDown}
      className={`nvx-theme ${className}`.trim()}
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = choice === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-theme-choice={id}
            data-on={on}
            onClick={() => setChoice(id)}
          >
            <Icon size={15} aria-hidden />
            <span>{tx(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
