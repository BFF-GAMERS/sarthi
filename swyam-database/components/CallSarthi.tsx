import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Phone, X } from "lucide-react";
import { useTx } from "../lib/i18n";

/**
 * Call me — Sarthi rings your phone.
 *
 * For a lot of the people this platform is for, a phone call is the most
 * usable interface there is: no data plan, no reading, no app. This asks for
 * a number and hands it to `/api/call`, which places the call through the
 * configured Sarvam voice agent in the language the chat is set to.
 *
 * The whole control hides itself when calling isn't configured, rather than
 * offering a button that would fail — the server is asked once on mount.
 */
export default function CallSarthi({ language, context }: { language: string; context?: string }) {
  const tx = useTx();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetch("/api/call")
      .then((r) => r.json())
      .then((b: { available?: boolean }) => live && setAvailable(b.available === true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  // Same rule the server applies, so an obvious typo is caught before we ask.
  const valid = /^(\+?91)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""));

  if (!available) return null;

  const call = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, language, context }),
      });
      const body = (await res.json()) as { ok?: boolean; to?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not place the call.");
      setPlaced(body.to ?? phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the call.");
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <p className="flex items-center gap-1.5 px-1 font-body text-[12px] text-emeraldx-400">
        <Check size={13} aria-hidden /> Calling {placed} now — pick up when it rings.
      </p>
    );
  }

  return (
    <div className="px-1">
      {open ? (
        <div className="rounded-xl border border-ink-line bg-paper p-3">
          <label className="block">
            <span className="datum">{tx("Your mobile number")}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              className="input mt-1 !py-2 !text-[13px]"
              aria-label={tx("Your mobile number")}
            />
          </label>
          <p className="mt-1.5 font-body text-[11px] leading-snug text-ink-mute">
            {tx(
              "Sarthi will call you and talk in the language selected above. Standard call charges may apply on your plan.",
            )}
          </p>
          {error && (
            <p role="alert" className="mt-2 font-body text-[12px] text-saffron-700">
              {error}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => void call()}
              disabled={!valid || busy}
              className="btn-primary flex-1 !py-2 !text-[11px] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <Phone size={13} aria-hidden />
              )}
              Call me
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              aria-label={tx("Cancel")}
              className="btn-ghost !px-3 !py-2 !text-[11px]"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.button
            initial={false}
            animate={{ opacity: 1 }}
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 font-body text-[11px] font-medium text-ink-mute transition-colors hover:text-saffron-600"
          >
            <Phone size={12} aria-hidden /> {tx("Prefer a phone call? Sarthi can ring you.")}
          </motion.button>
        </AnimatePresence>
      )}
    </div>
  );
}
