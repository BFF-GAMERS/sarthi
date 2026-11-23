import { useSearch } from "@tanstack/react-router";
import { BadgeCheck, Ban, Globe } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SerialLookup } from "../components/SerialLookup";
import { serialProblem } from "../lib/certificate";
import { useTx } from "../lib/i18n";

/**
 * /verify — where a serial is typed in.
 *
 * Every certificate tells employers to check the serial at swyam.online/verify,
 * and until now that address was a 404: only /verify/<serial> existed, which
 * is no use to someone holding a printed certificate and nothing else.
 */
export default function VerifyLookup() {
  const tx = useTx();
  const { serial } = useSearch({ from: "/verify/" });
  const points = [
    {
      icon: BadgeCheck,
      title: tx("Checked against the register"),
      body: tx("Not the paper: the record is read from स्वYAM's database and its seal is checked."),
    },
    {
      icon: Ban,
      title: tx("Withdrawn ones say so"),
      body: tx("A revoked, expired or altered certificate is named as such, not shown as valid."),
    },
    {
      icon: Globe,
      title: tx("Open to anyone"),
      body: tx("Employers, institutes, anyone with the serial. No account, no sign-up."),
    },
  ];

  return (
    <div className="container-x max-w-4xl pb-24 pt-28">
      <Reveal>
        <p className="kicker">{tx("Certificate check")}</p>
        <h1 className="mt-3 section-title">{tx("Check a certificate")}</h1>
        <p className="mt-4 max-w-xl font-body text-[15px] leading-relaxed text-ink-soft">
          {tx(
            "Every स्वYAM certificate carries a serial. Type it in to see whether it is genuine — who it was issued to, for which course, and when.",
          )}
        </p>
      </Reveal>

      <Reveal className="mt-8">
        {/* A ?serial= that reaches this page was not forwarded because it
            cannot be a serial — say so rather than showing an empty box. */}
        <SerialLookup
          initial={serial ?? ""}
          initialProblem={serial ? serialProblem(serial, tx) : null}
        />
      </Reveal>

      <Reveal className="mt-12">
        <ul className="grid gap-3 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <li key={title} className="panel p-5">
              <Icon size={20} className="text-saffron-500" aria-hidden />
              <p className="mt-3 font-body text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 font-body text-[13px] leading-relaxed text-ink-mute">{body}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
