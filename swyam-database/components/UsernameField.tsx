import { useEffect, useState } from "react";
import { AtSign, Check, Loader2, X } from "lucide-react";
import {
  USERNAME_HINT,
  USERNAME_RULE,
  isUsernameFree,
  normaliseUsername,
  type UsernameState,
} from "../lib/username";
import { useTx } from "../lib/i18n";

/**
 * Choosing a username, with the answer before the submit rather than after.
 *
 * The check runs against `handle_available` while they type, because the
 * alternative — find out on save — costs a round trip through a filled form
 * and, at sign-up, an account that has already been created under a name
 * they did not pick.
 *
 * Two deliberate details. Typing is never rejected: characters the column
 * will not accept are folded (uppercase) or dropped (spaces, dots) as they
 * are entered, so the field always holds something valid rather than turning
 * red at someone who typed their own name. And when the check itself cannot
 * run — offline, or the RPC blocked — the field says nothing rather than
 * claiming the name is free; the save is then the honest judge.
 */
export default function UsernameField({
  value,
  onChange,
  onStateChange,
  /** The member's current username, which is not "taken" as far as they are concerned. */
  ownValue,
  label = "Username",
  autoComplete = "username",
  id = "username",
}: {
  value: string;
  onChange: (next: string) => void;
  onStateChange?: (state: UsernameState) => void;
  ownValue?: string;
  label?: string;
  autoComplete?: string;
  id?: string;
}) {
  const tx = useTx();
  const [state, setState] = useState<UsernameState>("empty");

  useEffect(() => {
    const handle = value.trim();
    if (!handle) return void setState("empty");
    if (ownValue && handle === ownValue) return void setState("free");
    if (!USERNAME_RULE.test(handle)) return void setState("invalid");

    setState("checking");
    // The flag lives out here, not inside the timer: a reply that lands after
    // the member has typed another character must not overwrite the newer
    // answer with the older one.
    let live = true;
    // Long enough that a fast typist makes one request instead of twelve.
    const timer = window.setTimeout(() => {
      void isUsernameFree(handle).then((free) => {
        if (!live) return;
        setState(free === null ? "unknown" : free ? "free" : "taken");
      });
    }, 450);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [value, ownValue]);

  useEffect(() => {
    onStateChange?.(state);
    // The callback is usually an inline arrow; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-ink-soft">
        {tx(label)}
      </label>
      <div className="relative">
        <AtSign
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
        />
        <input
          id={id}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          maxLength={30}
          onChange={(e) => onChange(normaliseUsername(e.target.value))}
          className="input !pl-9"
          placeholder="aarav_sharma"
          aria-describedby={`${id}-note`}
        />
      </div>
      <p
        id={`${id}-note`}
        role={state === "taken" ? "alert" : undefined}
        className={`mt-1 flex items-center gap-1.5 font-body text-[12px] ${
          state === "taken" ? "text-saffron-700" : "text-ink-mute"
        }`}
      >
        {state === "checking" && <Loader2 size={12} className="animate-spin" aria-hidden />}
        {state === "free" && <Check size={12} className="text-emeraldx-400" aria-hidden />}
        {state === "taken" && <X size={12} aria-hidden />}
        {state === "empty" && tx(USERNAME_HINT)}
        {state === "invalid" && tx(USERNAME_HINT)}
        {state === "checking" && tx("Checking…")}
        {state === "free" && tx("Available")}
        {state === "taken" && tx("Already taken — try another.")}
        {state === "unknown" && tx(USERNAME_HINT)}
      </p>
    </div>
  );
}
