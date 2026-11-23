import { useTx } from "../lib/i18n";
import { setProfileType, typesForRole } from "../lib/profile-type";
import type { Role } from "../data/mock";

/**
 * The question that decides the dashboard.
 *
 * One page used to serve every student-role account, so a Class 8 student saw
 * the same openings and application counts as a job seeker. The navigation
 * that fixed that now lives in the rail and the bottom bar; what is left here
 * is the question itself, for an account that has never answered it.
 */

/** A student-role account that has not chosen which kind of student it is. */
export function TypePicker({
  email,
  role,
  profileId,
  onDone,
}: {
  email: string;
  role: Role;
  profileId: string | null;
  /** Called after a choice — the dashboard uses it to fold the picker away. */
  onDone?: () => void;
}) {
  const tx = useTx();
  const options = typesForRole(role);
  if (options.length <= 1) return null;
  /*
   * One line and four chips.
   *
   * This was a full bordered panel with a kicker, a heading, a paragraph and
   * four descriptive cards — the largest thing on the dashboard, above the
   * work, for a question that takes one tap. It is a question, not a
   * chapter: it reads as a question now.
   */
  return (
    <div className="quiet mt-6 p-4 sm:px-5">
      <p className="font-body text-[13.5px] text-ink-soft">
        <span className="font-semibold text-ink">{tx("Which of these is you?")}</span>{" "}
        {tx("The dashboard changes with the answer — changeable any time in Settings.")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={false}
            title={tx(o.purpose)}
            onClick={() => {
              setProfileType(email, o.id, profileId);
              onDone?.();
            }}
            className="filter-pill !h-10 !bg-paper-light"
          >
            {tx(o.label)}
            <span className="sr-only">. {tx(o.purpose)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
