import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Repeat2 } from "lucide-react";
import { listRequests, listSwaps, findMatches } from "../lib/skillswap";
import { Avatar } from "./SwapCards";
import { useTx } from "../lib/i18n";

/**
 * SkillSwap at a glance, for the profile sidebar.
 *
 * Deliberately a summary with a way through, not a second SkillSwap screen —
 * everything actionable lives on /skillswap.
 */
export default function SwapActivity({ profileId }: { profileId: string }) {
  const tx = useTx();
  const swaps = useQuery({ queryKey: ["swaps", profileId], queryFn: () => listSwaps(profileId) });
  const requests = useQuery({
    queryKey: ["swap-requests", profileId],
    queryFn: () => listRequests(profileId),
  });
  const matches = useQuery({
    queryKey: ["swap-matches", profileId],
    queryFn: () => findMatches(profileId, 3),
  });

  const active = (swaps.data ?? []).filter((s) => s.state === "active").length;
  const completed = (swaps.data ?? []).filter((s) => s.state === "completed").length;
  const waiting = (requests.data ?? []).filter(
    (r) => r.direction === "incoming" && r.state === "pending",
  ).length;
  const top = (matches.data ?? []).slice(0, 3);

  return (
    <div className="glass rounded-3xl p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
        <Repeat2 size={18} className="text-saffron-500" aria-hidden /> SkillSwap
      </h2>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Active", value: active },
          { label: "Waiting", value: waiting },
          { label: "Done", value: completed },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-paper-dim py-3">
            <dd className="font-display text-2xl leading-none text-ink tabular-nums">{s.value}</dd>
            <dt className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
              {s.label}
            </dt>
          </div>
        ))}
      </dl>

      {top.length > 0 && (
        <>
          <p className="datum mt-5">{tx("Top matches")}</p>
          <ul className="mt-2 space-y-2">
            {top.map((m) => (
              <li
                key={`${m.candidateId}-${m.theyTeach.id}`}
                className="flex items-center gap-2.5 rounded-2xl bg-paper-dim p-2.5"
              >
                <Avatar src={m.avatarUrl} name={m.displayName} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[13px] font-medium text-ink">
                    {m.displayName}
                  </span>
                  <span className="block truncate font-body text-[11px] text-ink-mute">
                    {m.theyTeach.name}
                    {m.youTeach ? ` ↔ ${m.youTeach.name}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-saffron-500">
                  {m.score}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link to="/skillswap" className="btn-ghost mt-4 w-full !py-2.5 !text-xs">
        {tx("Open SkillSwap")} <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
