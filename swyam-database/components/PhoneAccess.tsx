import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { getSupabase } from "../lib/supabase";
import { useTx } from "../lib/i18n";

/**
 * Phone access: the number Sarthi recognises when this member calls.
 *
 * Saved through public.voice_link_set (db/027), which stores only an HMAC of the number and
 * its last four digits, and refuses a number another account already uses. When a call comes
 * in, the backend matches the caller's number against this — nothing said on the call is
 * ever taken as who the caller is.
 */
export default function PhoneAccess({ profileId }: { profileId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = ["voice-phone-link", profileId];

  const link = useQuery({
    queryKey: key,
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return null;
      const { data, error: e } = await sb
        .from("voice_phone_links" as never)
        .select("phone_last4")
        .eq("profile_id", profileId)
        .maybeSingle();
      // Before db/027 is applied the table does not exist: show the form, not an error.
      if (e) return null;
      return (data as { phone_last4: string } | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const sb = getSupabase();
      if (!sb) throw new Error(tx("Not connected."));
      const { error: e } = await sb.rpc("voice_link_set" as never, { p_phone: phone } as never);
      if (e) throw new Error(e.message);
    },
    onSuccess: () => {
      setPhone("");
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) =>
      // Before db/027 is applied the function does not exist yet.
      setError(
        /could not find the function|schema cache/i.test(e.message)
          ? tx("Phone access is not switched on yet.")
          : e.message,
      ),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { error: e } = await sb.rpc("voice_link_remove" as never);
      if (e) throw new Error(e.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => setError(e.message),
  });

  const saved = link.data?.phone_last4;

  return (
    <section className="panel p-6" aria-labelledby="settings-phone">
      <h2
        id="settings-phone"
        className="flex items-center gap-2 font-display text-lg tracking-tight text-ink"
      >
        <Phone size={18} className="text-saffron-500" aria-hidden /> {tx("Phone access")}
      </h2>
      <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-ink-mute">
        {tx(
          "Call Sarthi from this number to find courses, enroll and hear where you left off — no internet needed. Sarthi only recognizes the number saved here.",
        )}
      </p>

      {saved ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-body text-sm text-ink">
            {tx("Saved number")}: <span className="font-mono">••••••{saved}</span>
          </p>
          <button
            type="button"
            className="btn-ghost !py-2 !text-xs"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {tx("Remove")}
          </button>
        </div>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <label className="min-w-[14rem] flex-1">
          <span className="font-body text-xs font-semibold text-ink-soft">
            {saved ? tx("Change number") : tx("Mobile number")}
          </span>
          <input
            className="input mt-1"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={16}
            required
          />
        </label>
        <button
          type="submit"
          className="btn-primary !py-2.5 !text-sm"
          disabled={save.isPending || !phone.trim()}
        >
          {save.isPending ? tx("Saving…") : tx("Save number")}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 font-body text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
