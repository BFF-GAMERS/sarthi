import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Columns3, X } from "lucide-react";
import { useTx } from "../../lib/i18n";
import { useStickyBar } from "../../lib/sticky-bar";
import {
  clearCompareGroup,
  removeCompareItem,
  useCompareGroup,
  type CompareEntry,
} from "../../lib/compare";
import { COMPARE_MIN, groupOf, type CompareGroup } from "../../lib/compare-fields";

/**
 * The compare tray: docked at the bottom of the lists while anything is picked.
 *
 * Route-aware — it appears on the places you pick from (jobs, internships,
 * courses, search) and nowhere else. On a phone it is one compact row that
 * sits above the bottom navigation; the assistant's pill lifts clear of it
 * through the same `--sticky-bar` variable a page's action bar uses.
 */

const ROUTE_GROUP: Record<string, CompareGroup | "any"> = {
  "/jobs": "opportunity",
  "/internships": "opportunity",
  "/courses": "course",
  "/search": "any",
};

/** Courses shortlisted before titles were kept: look the title up, once, off the main path. */
let courseTitles: Record<string, string> | null = null;
function useCourseTitles(needed: boolean): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(courseTitles ?? {});
  useEffect(() => {
    if (!needed || courseTitles) return;
    let alive = true;
    import("../../data/mock").then((m) => {
      courseTitles = Object.fromEntries(m.courses.map((c) => [c.id, c.title]));
      if (alive) setMap(courseTitles);
    });
    return () => {
      alive = false;
    };
  }, [needed]);
  return map;
}

export default function CompareDock() {
  const tx = useTx();
  const path = useRouterState({ select: (s) => s.location.pathname }).replace(/\/+$/, "") || "/";
  const opportunities = useCompareGroup("opportunity");
  const courses = useCompareGroup("course");

  const where = ROUTE_GROUP[path];
  // The group of this page if it has picks; otherwise whichever does, so a
  // pick made elsewhere can always be seen and cleared from here.
  const group: CompareGroup | null = !where
    ? null
    : where !== "any" && (where === "course" ? courses : opportunities).length > 0
      ? where
      : opportunities.length > 0
        ? "opportunity"
        : courses.length > 0
          ? "course"
          : null;
  const entries: CompareEntry[] =
    group === "course" ? courses : group === "opportunity" ? opportunities : [];
  const visible = entries.length > 0;

  useStickyBar(visible);
  const titles = useCourseTitles(visible && group === "course" && entries.some((e) => !e.title));

  if (!visible || !group) return null;

  const n = entries.length;
  const ready = n >= COMPARE_MIN;
  const kind = entries[0]!.kind;
  const reasonId = "cmp-dock-reason";

  return (
    <div
      role="region"
      aria-label={tx("Compare tray")}
      className="cmp-dock fixed inset-x-0 bottom-[var(--bottom-bar,0px)] z-[44]"
    >
      <div className="app-main">
        <div className="container-x flex items-center gap-2 py-2">
          <Columns3 size={18} className="hidden shrink-0 text-saffron-600 sm:block" aria-hidden />
          <ul className="cmp-chips" aria-label={tx("Picked to compare")}>
            {entries.map((e) => {
              const title = e.title || titles[e.id] || e.id;
              return (
                <li key={e.id} className="cmp-chip">
                  <span title={title}>{title}</span>
                  <button
                    type="button"
                    className="cmp-icon-btn"
                    aria-label={`${tx("Remove")} ${title} ${tx("from comparison")}`}
                    onClick={() => removeCompareItem(groupOf(e.kind), e.id)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              );
            })}
            {!ready && (
              <li id={reasonId} className="shrink-0 font-body text-[12px] text-ink-mute">
                {tx("Pick one more to compare")}
              </li>
            )}
          </ul>
          <Link
            to="/compare"
            search={{ kind, ids: entries.map((e) => e.id).join(",") }}
            className={`btn-primary cmp-go shrink-0 !min-h-[44px] !px-4 !py-2.5 !text-xs`}
            aria-disabled={!ready}
            aria-describedby={ready ? undefined : reasonId}
            onClick={(e) => {
              if (!ready) e.preventDefault();
            }}
          >
            {tx("Compare")} ({n}) <ArrowRight size={14} aria-hidden />
          </Link>
          <button
            type="button"
            className="cmp-icon-btn !w-auto px-2 font-body text-[12px] underline"
            onClick={() => clearCompareGroup(group)}
          >
            <span className="hidden sm:inline">{tx("Clear")}</span>
            <X size={16} aria-hidden className="sm:hidden" />
            <span className="sr-only sm:hidden">{tx("Clear")}</span>
          </button>
        </div>
      </div>
      <p className="sr-only" role="status">
        {n} {tx("picked to compare")}
      </p>
    </div>
  );
}
