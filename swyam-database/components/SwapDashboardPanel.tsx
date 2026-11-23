import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Repeat2 } from "lucide-react";
import { findMatches, listRequests, type SwapMatch, type SwapRequest } from "../lib/skillswap";
import { Avatar, SwapLine } from "./SwapCards";
import { useTx } from "../lib/i18n";
import { track, EV } from "@/evolution";

/**
 * SkillSwap on the dashboard.
 *
 * Shows only what needs a decision — requests waiting on you, and the few
 * strongest matches. Anything actionable beyond a glance lives on /skillswap,
 * so this stays a prompt rather than a second copy of that page.
 */
export default function SwapDashboardPanel({ profileId }: { profileId: string }) {
  const tx = useTx();
  const requests = useQuery({
    queryKey: ["swap-requests", profileId],
    queryFn: () => listRequests(profileId),
  });
  const matches = useQuery({
    queryKey: ["swap-matches", profileId],
    queryFn: () => findMatches(profileId, 4),
  });

  const waiting: SwapRequest[] = (requests.data ?? []).filter(
    (r) => r.direction === "incoming" && r.state === "pending",
  );
  const top: SwapMatch[] = matches.data ?? [];

  // Nothing to say yet — don't take up a slot on the dashboard.
  if (!requests.isLoading && !matches.isLoading && waiting.length === 0 && top.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-body text-lg font-medium tracking-tight text-ink">
          <Repeat2 size={19} className="text-saffron-500" aria-hidden /> SkillSwap
        </h2>
        <Link
          to="/skillswap"
          className="inline-flex items-center gap-1 font-body text-xs font-medium text-saffron-500 hover:text-saffron-600"
        >
          {tx("See all")} <ArrowRight size={13} aria-hidden />
        </Link>
      </div>

      {waiting.length > 0 && (
        <div className="mt-5">
          <p className="datum">
            {waiting.length} request{waiting.length === 1 ? "" : "s"} waiting on you
          </p>
          <ul className="mt-2 space-y-2">
            {waiting.slice(0, 2).map((r, i) => (
              <li key={r.id}>
                <Link
                  to="/skillswap"
                  onClick={() =>
                    track(EV.RECOMMENDATION_CLICKED, {
                      surface: "swap-panel",
                      rank: i + 1,
                      via: "static",
                    })
                  }
                  className="flex items-center gap-3 rounded-2xl border border-saffron-200 bg-saffron-50 p-3 transition-colors hover:bg-saffron-100"
                >
                  <Avatar
                    src={r.counterpart.avatarUrl}
                    name={r.counterpart.displayName}
                    size={36}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium text-ink">
                      {r.counterpart.displayName}
                    </span>
                    <span className="block truncate font-body text-[11px] text-ink-mute">
                      {r.offeredSkill ? `Offers ${r.offeredSkill.name} · ` : "Learning · "}wants{" "}
                      {r.requestedSkill.name}
                    </span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-saffron-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-5">
          <p className="datum">{tx("Strongest matches")}</p>
          <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {top.slice(0, 4).map((m) => (
              <li
                key={`${m.candidateId}-${m.theyTeach.id}`}
                className="rounded-2xl border border-ink-line bg-paper p-3"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar src={m.avatarUrl} name={m.displayName} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium text-ink">
                      {m.displayName}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-saffron-500">
                    {m.score}
                  </span>
                </div>
                <div className="mt-2">
                  <SwapLine
                    theyTeach={m.theyTeach.name}
                    youTeach={m.youTeach?.name ?? null}
                    theirName={m.displayName}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
