import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus, X } from "lucide-react";
import { initialsAvatar } from "../lib/avatar";
import { pendingFollowRequests, respondToFollow, type PersonRow } from "../lib/people";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { useTx } from "../lib/i18n";

/**
 * People waiting for you to let them in.
 *
 * `db/006` made a follow on a `connections` or `private` profile a *request*
 * rather than a fait accompli, and gave the owner `respond_to_follow` to
 * accept or refuse it. `people.ts` wrapped both. Then nothing called them:
 * the request arrived, the notification fired, and the only screen that
 * could have resolved it did not exist. So anybody who had tightened their
 * profile — the people the feature was built for — collected requests they
 * could never answer, and the person who asked waited on a decision nobody
 * could make.
 *
 * This is that screen. It lives on your own profile, because "who may see
 * this" is a question about the page you are standing on.
 *
 * It draws nothing when there is nothing waiting. An empty panel headed
 * "Requests" is a promise that the product has something to tell you, and
 * for most people, most of the time, it does not.
 */
export default function ConnectionRequests() {
  const tx = useTx();
  const toast = useToast();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  /* Which row is mid-decision. Disabling every button while one resolves
     would make a list of five feel broken. */
  const [busy, setBusy] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["follow-requests", profileId],
    queryFn: pendingFollowRequests,
    enabled: !!profileId,
    staleTime: 30_000,
  });

  const respond = useMutation({
    mutationFn: ({ person, accept }: { person: PersonRow; accept: boolean }) =>
      respondToFollow(person.id, accept),
    onMutate: ({ person }) => setBusy(person.id),
    onSettled: () => setBusy(null),
    onSuccess: (_void, { person, accept }) => {
      qc.invalidateQueries({ queryKey: ["follow-requests", profileId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast(
        accept
          ? {
              tone: "ok",
              title: tx("Accepted"),
              body: `${person.name} ${tx("can now see your profile and your skill passport.")}`,
              action: { label: tx("See their profile"), to: `/u/${person.handle}` },
            }
          : {
              tone: "info",
              title: tx("Request removed"),
              // Refusing deletes the row rather than storing a refusal, so
              // this is true, and saying it prevents the obvious worry that
              // the person has been told they were turned down.
              body: tx("They are not told. They can ask again later."),
            },
      );
    },
    onError: (e: Error) =>
      toast({ tone: "bad", title: tx("That didn't go through"), body: e.message }),
  });

  const people = requests.data ?? [];
  if (!profileId || requests.isLoading || people.length === 0) return null;

  return (
    <section className="panel p-6" aria-labelledby="requests-title">
      <div className="flex items-baseline gap-2">
        <h2
          id="requests-title"
          className="flex items-center gap-2 font-display text-lg tracking-tight text-ink"
        >
          <UserPlus size={17} className="text-saffron-500" aria-hidden />
          {tx("Wants to connect")}
        </h2>
        <span className="font-mono text-[12px] tabular-nums text-ink-mute">{people.length}</span>
      </div>
      <p className="mt-1.5 font-body text-[12.5px] leading-relaxed text-ink-mute">
        {tx("Accepting lets them see your profile, your skills and your skill passport.")}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-[var(--radius-control)] border border-ink-line p-3"
          >
            <img
              src={p.avatarUrl || initialsAvatar(p.name)}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 flex-1">
              {/* The name is the link. Deciding on a stranger without being
                  able to look at them first is not a decision. */}
              <Link
                to="/u/$handle"
                params={{ handle: p.handle }}
                className="block truncate font-body text-[14px] font-semibold text-ink underline-offset-2 hover:underline"
              >
                {p.name}
              </Link>
              <p className="truncate font-body text-[12px] text-ink-mute">
                {p.headline ? p.headline : `@${p.handle}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => respond.mutate({ person: p, accept: true })}
                className="btn-primary !gap-1.5 !px-3.5 !py-2 !text-[13px]"
              >
                <Check size={14} aria-hidden />
                {tx("Accept")}
              </button>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => respond.mutate({ person: p, accept: false })}
                aria-label={`${tx("Ignore request from")} ${p.name}`}
                className="btn-ghost !gap-1.5 !px-3 !py-2 !text-[13px]"
              >
                <X size={14} aria-hidden />
                {tx("Ignore")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
