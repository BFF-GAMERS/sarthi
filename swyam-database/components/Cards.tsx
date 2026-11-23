import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  IndianRupee,
  Star,
  Bookmark,
  ArrowUpRight,
  Clock,
  Briefcase,
  GraduationCap,
  Signal,
  Users,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCardExpand } from "../lib/use-card-expand";
import { useAuth } from "../context/AuthContext";
import { trackSaved } from "@/evolution/runtime/tracker/save-event";
import { listSaves, toggleSave, type SaveKind } from "../lib/profile-data";
import { getEnrollment, resolveCourseId, resolveOpportunityId } from "../lib/catalogue";
import { AddToCartButton } from "./ActionButtons";
import type { Course, Organization } from "../data/mock";
import { orgById } from "../data/mock";
import { useTx } from "../lib/i18n";
import CompareCheckbox from "./compare/CompareCheckbox";
import ListingDecoded from "./ListingDecoded";
import OfflineBadge from "./offline/OfflineBadge";
import ReturnTick from "./return/ReturnTick";
import { useUndoable } from "./undo/useUndoable";
import Media from "./Media";
import { useToast } from "./Toast";
import { rememberIntent } from "../lib/pending-intent";

/**
 * A rating, or an honest admission that there is not one.
 */
export function StarRating({
  value,
  count,
  enrolled,
}: {
  value: number;
  count?: number;
  /**
   * Courses only: shown instead of "not rated" when there are learners but no
   * reviews yet, or "New course" at zero. Left out (organizations, reviews),
   * an unrated item shows nothing.
   */
  enrolled?: number;
}) {
  if (!value || count === 0) {
    // A catalog where every card says "Not rated yet" reads as a catalog
    // nobody has taken. Say what is true instead: how many have enrolled,
    // or that the course is new. Only a course can be "new"; anything else
    // without a rating simply shows no rating.
    if (enrolled === undefined) return null;
    return (
      <span className="font-body text-xs text-ink-mute">
        {enrolled > 0 ? `${enrolled.toLocaleString("en-IN")} enrolled` : "New course"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-1.5" aria-label={`Rated ${value} out of 5`}>
      <Star size={13} className="translate-y-0.5 fill-saffron-500 text-saffron-500" aria-hidden />
      <span className="font-body text-sm font-semibold leading-none text-ink">{value}</span>
      {count !== undefined && <span className="text-xs text-ink-mute">({count})</span>}
    </span>
  );
}

/**
 * Save an item to the member's list. Writes to `saves`, so the mark survives
 * a reload and the Profile page can list it.
 */
/**
 * Save, and mean it.
 *
 * Signed out, this used to darken the icon and write nothing anywhere: the
 * page said "Saved" and the next page load disagreed. Now the intent is
 * remembered, the sign-in carries the page back, and the save completes by
 * itself on the other side.
 */
export function BookmarkButton({
  label = "Save",
  kind,
  slug,
  title,
}: {
  label?: string;
  kind?: SaveKind;
  /** The catalogue id (a slug). Resolved to a row uuid before saving. */
  slug?: string;
  /** What it is called, so the confirmation can name it. */
  title?: string;
}) {
  const tx = useTx();
  const { user, profileId } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const undoable = useUndoable();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !kind) return;
    let live = true;
    const resolve = kind === "course" ? resolveCourseId : resolveOpportunityId;
    void resolve(slug)
      .then((id) => live && setTargetId(id))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [slug, kind]);

  const persistable = Boolean(profileId && kind && targetId);

  const { data: saves } = useQuery({
    queryKey: ["saves", profileId],
    queryFn: () => listSaves(profileId!),
    enabled: Boolean(profileId),
  });
  useEffect(() => {
    if (!persistable || !saves) return;
    setSaved(saves.some((s) => s.kind === kind && s.targetId === targetId));
  }, [saves, persistable, kind, targetId]);

  const onClick = async () => {
    // Signed out: remember what they wanted, then ask. The save happens on
    // the way back (see IntentResume), so nobody has to find this card again.
    if (!user && slug && kind) {
      rememberIntent({
        kind: kind === "course" ? "save-course" : "save-job",
        slug,
        title: title ?? label,
        path: window.location.pathname,
      });
      toast({
        tone: "info",
        title: "Sign in to save this",
        body: "It is free, and we will save it the moment you are in.",
      });
      void navigate({
        to: "/auth",
        search: { mode: "signup", next: window.location.pathname },
      });
      return;
    }
    if (!persistable || busy) return;
    const was = saved;
    // The save happens now; Undo (button, bar or Ctrl+Z) flips it back. The
    // tracking event waits for the window to close, so a save that was taken
    // back is not counted as one.
    undoable.start({
      id: `save:${was ? "remove" : "add"}:${kind}:${targetId}`,
      label: was ? tx("Removed from saved") : tx("Saved"),
      undoneLabel: was ? tx("Removal undone") : tx("Save undone"),
      optimistic: async () => {
        setBusy(true);
        try {
          const next = await toggleSave(profileId!, kind!, targetId!, was);
          setSaved(next);
          void qc.invalidateQueries({ queryKey: ["saves", profileId] });
          toast(
            next
              ? {
                  title: title ? `Saved — ${title}` : "Saved",
                  action: { label: "See everything saved", to: "/saved" },
                }
              : { tone: "info", title: title ? `Removed — ${title}` : "Removed from saved" },
          );
        } catch (e) {
          toast({
            tone: "bad",
            title: "That did not save",
            body: e instanceof Error ? e.message : "Try again in a moment.",
          });
          throw e;
        } finally {
          setBusy(false);
        }
      },
      revert: async () => {
        try {
          const back = await toggleSave(profileId!, kind!, targetId!, !was);
          setSaved(back);
          void qc.invalidateQueries({ queryKey: ["saves", profileId] });
        } catch (e) {
          toast({
            tone: "bad",
            title: "Could not undo that",
            body: e instanceof Error ? e.message : "Try again in a moment.",
          });
        }
      },
      commit: async () => {
        if (!was) trackSaved(kind, slug);
      },
    });
  };

  return (
    <button
      onClick={() => void onClick()}
      disabled={busy}
      aria-busy={busy || undefined}
      title={user ? undefined : "Sign in to save this"}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 font-body text-[12px] font-semibold transition-[color,background-color,border-color] duration-200 disabled:opacity-60 ${
        saved
          ? "border-transparent bg-ink text-paper"
          : "border-ink-line bg-paper-light text-ink-soft hover:border-ink/25 hover:text-ink"
      }`}
      aria-pressed={saved}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" aria-hidden />
      ) : (
        <Bookmark size={14} className={saved ? "fill-current" : ""} aria-hidden />
      )}
      {saved ? "Saved" : label}
    </button>
  );
}

/* Small labelled fact used inside the revealed half of every card. */
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 font-body text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-mute">
        <span className="text-saffron-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-body text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SkillChips({ items, max = 4 }: { items: string[]; max?: number }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((s) => (
        <li key={s} className="chip">
          {s}
        </li>
      ))}
      {items.length > max && <li className="chip">+{items.length - max}</li>}
    </ul>
  );
}

/* ── Course ───────────────────────────────────────────────────────
   Two shapes, one card.

   On a phone it is a row — a square thumbnail and four lines beside it —
   because a list is for scanning and a 400px card means four courses per
   screenful of scrolling. From `sm` up there is room for the photo-in-a-
   frame version, and on a pointing device hovering reveals the overview,
   the facts and the actions in place of a hover that would do nothing. */
export function CourseCard({ course }: { course: Course }) {
  const tx = useTx();
  const org = orgById(course.orgId);
  const duration = course.duration.split("\u00b7")[0].trim();
  return (
    /*
     * A ticket, not a brochure. A list is scanned for four things: what it is, who runs it, how
     * long it takes and what it costs. Everything else (the decoded listing, outcomes, actions) is
     * on the course page, one tap away; forty cards each carrying all of it read as a wall.
     */
    <article
      data-return-id={course.id}
      data-group={course.group}
      className="card card-reveal course-ticket group relative flex h-full flex-row gap-3 p-2 sm:flex-col sm:gap-0 sm:p-0"
    >
      <ReturnTick />
      <Media
        src={course.hero}
        ratio={null}
        className="aspect-square w-[6.75rem] shrink-0 self-start rounded-xl sm:aspect-[16/9] sm:w-full sm:rounded-none"
        imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      >
        {course.free && (
          <span className="sticker absolute left-3 top-3 hidden sm:inline-block">{tx("Free")}</span>
        )}
      </Media>

      <div className="flex min-w-0 flex-1 flex-col pr-1 sm:p-4">
        <p className="course-ticket-group">{tx(course.group)}</p>
        {/* The title's link covers the card, so the whole thing is the tap target. */}
        <h3 className="course-ticket-title mt-1 line-clamp-2 font-display text-[1.1rem] font-semibold leading-snug text-ink transition-colors duration-200 group-hover:text-saffron-600">
          <Link
            to="/courses/$id"
            params={{ id: course.id }}
            className="after:absolute after:inset-0"
          >
            {course.title}
          </Link>
        </h3>
        <p className="mt-1 truncate font-body text-[13px] text-ink-mute">{org.name}</p>
        <OfflineBadge courseSlug={course.id} className="mt-1.5" />

        <div className="course-ticket-stub mt-auto">
          <span className="min-w-0 truncate font-body text-[12.5px] text-ink-soft">
            {duration} · {course.difficulty}
          </span>
          <span
            className={`shrink-0 font-display text-[1.05rem] font-semibold leading-none ${course.free ? "text-emeraldx-400" : "text-ink"}`}
          >
            {course.free ? tx("Free") : course.fees}
          </span>
        </div>
      </div>
    </article>
  );
}

/*
   JobCard and InternshipCard were deleted with the seed data they drew.

   Every listing that shows an opening — /jobs, /internships, the search
   page, a company's own page — renders OpportunityCard against the real
   record an employer posted. These two drew the invented ones, and once
   search stopped reading them nothing rendered either card at all.
*/

/* ── Organization ───────────────────────────────────────────────── */
export function OrgCard({ org }: { org: Organization }) {
  const tx = useTx();
  return (
    <Link to="/orgs/$id" params={{ id: org.id }} className="card group block p-2">
      <OrgCover
        src={org.cover}
        className="aspect-[16/10] rounded-[calc(var(--radius-card)-0.5rem)]"
      />
      <div className="px-3 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <img
            src={org.logo}
            alt=""
            loading="lazy"
            decoding="async"
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 rounded-xl border border-ink-line object-cover"
          />
          <span className="chip">{org.type === "institute" ? tx("Institute") : tx("Company")}</span>
        </div>
        <h3 className="font-display text-[1.05rem] font-semibold leading-snug tracking-tight text-ink transition-colors duration-200 group-hover:text-saffron-600">
          {org.name}
        </h3>
        <p className="mt-1.5 inline-flex items-center gap-1 font-body text-[13px] text-ink-mute">
          <MapPin size={12} aria-hidden /> {org.location}
        </p>
        {org.rating > 0 && (
          <div className="mt-3 border-t border-ink-line pt-2.5">
            <StarRating value={org.rating} />
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Uncropped photo frame: the whole image at its own aspect ratio, over a
 * blurred copy of itself so the frame never shows an empty bar.
 */
function OrgCover({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden bg-paper-dim ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl saturate-150"
      />
      <span className="absolute inset-0 bg-paper-light/25" aria-hidden />
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain object-center transition-transform duration-700 group-hover:scale-[1.03]"
      />
    </div>
  );
}

/**
 * The card's main action: enrol, or continue where they stopped.
 */
function CourseCardAction({ course }: { course: Course }) {
  const tx = useTx();
  const { profileId, isRemote } = useAuth();

  const status = useQuery({
    queryKey: ["enrollment", profileId, course.id],
    queryFn: () => getEnrollment(profileId!, course.id),
    enabled: Boolean(profileId) && isRemote,
  });

  const enrolled = status.data?.enrolled ?? false;
  const percent = Math.round(status.data?.progressPercent ?? 0);

  if (enrolled) {
    return (
      <Link
        to="/learn/$slug"
        params={{ slug: course.id }}
        className="btn-primary flex-1 !py-2.5 !text-xs"
      >
        {percent > 0 ? `${tx("Continue")} · ${percent}%` : tx("Start learning")}
        <ArrowUpRight size={15} aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      to="/courses/$id"
      params={{ id: course.id }}
      className="btn-primary flex-1 !py-2.5 !text-xs"
    >
      {tx("Enroll now")} <ArrowUpRight size={15} aria-hidden />
    </Link>
  );
}
