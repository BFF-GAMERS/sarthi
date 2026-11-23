import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getProfileCard, requestFollow, unfollow, type FollowState } from "../lib/people";
import { useTx } from "../lib/i18n";

/**
 * Follow, request, or stop following.
 *
 * The button this replaces wrote straight to the `follows` table. That was
 * fine while every profile was public, but it made the follow unconditional:
 * there was no way for anyone to be asked first. Now it calls
 * `request_follow`, and the *server* decides which of the two things happened
 * based on the target's visibility — a public profile is followed, anything
 * else becomes a request. The button says what came back.
 *
 * Deciding that in the browser was never an option. It would mean reading
 * somebody else's privacy setting and then choosing to respect it, which is a
 * privacy rule enforced on the honour system.
 *
 * `initialState` lets a page that already fetched a profile card skip the
 * lookup. Without it the button asks for itself, which is what makes it
 * droppable anywhere a profile id is in hand.
 */
export default function FollowButton({
  targetId,
  handle,
  initialState,
  size = "sm",
  className = "",
}: {
  targetId: string;
  /** Only needed when there is no `initialState` to read the relationship from. */
  handle?: string;
  initialState?: FollowState | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const tx = useTx();
  const qc = useQueryClient();
  const { profileId } = useAuth();
  const self = !profileId || profileId === targetId;

  // Only asked when the caller could not tell us and we have a handle to ask
  // with. A list of twenty people should pass initialState, not fire twenty
  // requests.
  const looked = useQuery({
    queryKey: ["follow-state", profileId, targetId],
    queryFn: async () => (await getProfileCard(handle!)).followState,
    enabled: !self && initialState === undefined && Boolean(handle),
  });

  const state: FollowState | null | undefined =
    initialState !== undefined ? initialState : looked.data;

  const toggle = useMutation({
    mutationFn: async (): Promise<FollowState | null> => {
      // "Requested" cancels the request; there is no other way to withdraw one.
      if (state === "accepted" || state === "pending") {
        await unfollow(targetId, profileId!);
        return null;
      }
      return requestFollow(targetId);
    },
    onSuccess: (next) => {
      qc.setQueryData(["follow-state", profileId, targetId], next);
      void qc.invalidateQueries({ queryKey: ["profile-card"] });
      void qc.invalidateQueries({ queryKey: ["follow-list"] });
      void qc.invalidateQueries({ queryKey: ["suggested-people"] });
    },
  });

  if (self) return null;

  const pad = size === "md" ? "!px-4 !py-2 !text-xs" : "!px-3 !py-1.5 !text-[11px]";
  const busy = toggle.isPending || (initialState === undefined && looked.isLoading);

  const label =
    state === "accepted" ? tx("Following") : state === "pending" ? tx("Requested") : tx("Follow");

  return (
    <span className="inline-flex flex-col items-stretch">
      <button
        onClick={() => toggle.mutate()}
        disabled={busy}
        aria-pressed={state === "accepted"}
        className={`${state ? "btn-ghost" : "btn-primary"} shrink-0 ${pad} disabled:opacity-60 ${className}`}
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : state === "accepted" ? (
          <Check size={12} aria-hidden />
        ) : state === "pending" ? (
          <Clock size={12} aria-hidden />
        ) : (
          <UserPlus size={12} aria-hidden />
        )}
        {label}
      </button>
      {toggle.error && (
        <span role="alert" className="mt-1 font-body text-[11px] text-saffron-700">
          {toggle.error instanceof Error ? toggle.error.message : tx("That did not work.")}
        </span>
      )}
    </span>
  );
}
