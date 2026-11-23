import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bookmark, BookOpen, Briefcase, Columns3, Trash2 } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import { useAuth } from "../context/AuthContext";
import { useTx } from "../lib/i18n";
import { listSaves, toggleSave, type SavedItem, type SaveKind } from "../lib/profile-data";
import { useToast } from "../components/Toast";
import { COMPARE_MAX, toggleCompare, useCompare } from "../lib/compare";

/**
 * Everything you kept.
 *
 * Save has worked for a while and written a real row every time — and there
 * was nowhere to see the result. A bookmark you cannot find again is a
 * button that pretends. This is the page the Save button has always implied,
 * and the one the confirmation toast now links to.
 *
 * Three groups, because they lead different places: courses you meant to
 * start, openings you meant to apply to, and everything else. Each row can
 * be opened or un-saved where it sits.
 */
export default function Saved() {
  const tx = useTx();
  const navigate = useNavigate();
  const { user, profileId, ready } = useAuth();
  const [filter, setFilter] = useState<"all" | "course" | "work">("all");

  useEffect(() => {
    if (ready && !user)
      navigate({ to: "/auth", search: { mode: "login", next: window.location.pathname } });
  }, [ready, user, navigate]);

  const saves = useQuery({
    queryKey: ["saves", profileId],
    queryFn: () => listSaves(profileId!),
    enabled: Boolean(profileId),
  });

  const rows = saves.data ?? [];
  const courses = rows.filter((r) => r.kind === "course");
  const work = rows.filter((r) => r.kind === "job" || r.kind === "internship");
  const other = rows.filter((r) => !["course", "job", "internship"].includes(r.kind));
  const shown = filter === "course" ? courses : filter === "work" ? work : rows;

  return (
    <div className="container-x max-w-4xl pb-24 pt-32">
      <Reveal>
        <SloganPlate tone="marigold">{tx("Saved")}</SloganPlate>
        <h1 className="section-title mt-3">{tx("Everything you kept")}</h1>
        <BlockPrintRule className="mt-5" />
        <p className="mt-4 max-w-2xl font-body text-[14.5px] leading-relaxed text-ink-soft">
          {tx(
            "Saved on your account, not this device — the same list on your phone and on a shared computer at the center.",
          )}
        </p>
      </Reveal>

      {rows.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: tx("Everything"), n: rows.length },
              { id: "course", label: tx("Courses"), n: courses.length },
              { id: "work", label: tx("Jobs & internships"), n: work.length },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`filter-pill !h-10 ${filter === f.id ? "!bg-ink !text-paper" : ""}`}
            >
              {f.label}
              <span className="font-mono text-[11px] tabular-nums opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
      )}

      {saves.isLoading ? (
        <ul className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-2xl bg-paper-dim" />
          ))}
        </ul>
      ) : saves.isError ? (
        <p role="alert" className="mt-8 font-body text-sm text-danger">
          {tx("Your saved list could not be loaded. Refresh and try again.")}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-line p-8 text-center">
          <Bookmark size={22} className="mx-auto text-ink-mute" aria-hidden />
          <p className="mt-3 font-display text-lg text-ink">{tx("Nothing saved yet")}</p>
          <p className="mx-auto mt-1.5 max-w-sm font-body text-[13.5px] leading-relaxed text-ink-mute">
            {tx(
              "Press Save on any course or opening and it waits here — on your account, so it follows you to another device.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/courses" className="btn-primary !py-2.5 !text-xs">
              {tx("Browse courses")} <ArrowRight size={14} aria-hidden />
            </Link>
            <Link to="/jobs" className="btn-ghost !py-2.5 !text-xs">
              {tx("Browse openings")}
            </Link>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-8 font-body text-sm text-ink-mute">
          {tx("Nothing saved in this group yet.")}
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {shown.map((item) => (
            <Row key={`${item.kind}-${item.targetId}`} item={item} profileId={profileId!} />
          ))}
        </ul>
      )}

      {other.length > 0 && filter === "all" && (
        <p className="mt-6 font-body text-[12px] text-ink-mute">
          {tx(
            "Saved posts and profiles are in the community and on the people themselves; only courses and openings are listed here.",
          )}
        </p>
      )}
    </div>
  );
}

const ICON: Partial<Record<SaveKind, React.ReactNode>> = {
  course: <BookOpen size={16} aria-hidden />,
  job: <Briefcase size={16} aria-hidden />,
  internship: <Briefcase size={16} aria-hidden />,
};

function Row({ item, profileId }: { item: SavedItem; profileId: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const toast = useToast();
  const comparing = useCompare();

  const remove = useMutation({
    mutationFn: () => toggleSave(profileId, item.kind, item.targetId, true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saves", profileId] });
      toast({ tone: "info", title: `${tx("Removed")} — ${item.title}` });
    },
    onError: (e: Error) => toast({ tone: "bad", title: tx("That did not work"), body: e.message }),
  });

  const to =
    item.slug === null
      ? null
      : item.kind === "course"
        ? `/courses/${item.slug}`
        : item.kind === "internship"
          ? `/internships/${item.slug}`
          : `/jobs/${item.slug}`;

  const inCompare = item.kind === "course" && item.slug ? comparing.includes(item.slug) : false;

  return (
    <li className="card flex flex-wrap items-center gap-3 p-4">
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron-50 text-saffron-600"
      >
        {ICON[item.kind] ?? <Bookmark size={16} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[14.5px] font-medium text-ink">
          {to ? (
            <Link to={to} className="hover:text-saffron-600">
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </p>
        <p className="truncate font-body text-[12.5px] text-ink-mute">
          {item.meta}
          {item.slug === null && ` · ${tx("no longer listed")}`}
        </p>
      </div>

      {item.kind === "course" && item.slug && (
        <button
          type="button"
          onClick={() => {
            const ok = toggleCompare(item.slug!);
            if (!ok)
              toast({
                tone: "info",
                title: tx("Three is the most you can compare at once"),
              });
          }}
          aria-pressed={inCompare}
          className={`filter-pill !h-9 !px-3 !text-[12px] ${inCompare ? "!bg-ink !text-paper" : ""}`}
          title={`${tx("Compare")} · ${COMPARE_MAX}`}
        >
          <Columns3 size={13} aria-hidden />
          {inCompare ? tx("Comparing") : tx("Compare")}
        </button>
      )}

      {to && (
        <Link to={to} className="btn-ghost !px-3 !py-2 !text-[12px]">
          {tx("Open")} <ArrowRight size={13} aria-hidden />
        </Link>
      )}

      <button
        type="button"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        aria-label={`${tx("Remove from saved")}: ${item.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute transition-colors hover:bg-paper-dim hover:text-ink"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
