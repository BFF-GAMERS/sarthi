import { useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, Check, Link2 } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SloganPlate, BlockPrintRule } from "../components/Ornaments";
import CompareTable, { COMPARE_FOCUS_ID } from "../components/compare/CompareTable";
import { feeLine, hoursPerWeek, startLine } from "../components/CourseFacts";
import { courses, orgById } from "../data/mock";
import { getOpportunity, type Opportunity } from "../lib/opportunities";
import { clearCompareGroup, removeCompareItem, useCompareGroup } from "../lib/compare";
import {
  COMPARE_MIN,
  compareHref,
  courseColumns,
  courseRows,
  groupOf,
  opportunityColumns,
  opportunityRows,
  parseCompareParams,
  type CompareGroup,
  type CompareKind,
} from "../lib/compare-fields";
import { useTx } from "../lib/i18n";

const focusTable = () =>
  requestAnimationFrame(() => document.getElementById(COMPARE_FOCUS_ID)?.focus());

/**
 * Two or three jobs, internships or courses, side by side.
 *
 * Where the items come from, in order: the link (`?kind=&ids=`, which works
 * for anyone, on any device, signed in or not), then this device's shortlist.
 * `forceKind` is the old /courses/compare page: same table, shortlist only.
 */
export default function Compare({ forceKind }: { forceKind?: CompareKind } = {}) {
  const tx = useTx();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { kind?: unknown; ids?: unknown };
  const shortOpp = useCompareGroup("opportunity");
  const shortCourse = useCompareGroup("course");
  const [note, setNote] = useState("");
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const manual = useRef<HTMLInputElement>(null);

  // 1. The link, if it carries a valid one; 2. the shortlist on this device.
  const fromLink = forceKind ? null : parseCompareParams(search, { min: 1 });
  const fromUrl = !!fromLink && fromLink.ok;
  const group: CompareGroup =
    fromLink && fromLink.ok
      ? groupOf(fromLink.kind)
      : forceKind
        ? groupOf(forceKind)
        : shortOpp.length > 0
          ? "opportunity"
          : shortCourse.length > 0
            ? "course"
            : "opportunity";
  const shortlist = group === "course" ? shortCourse : shortOpp;
  const ids = fromLink && fromLink.ok ? fromLink.ids : shortlist.map((e) => e.id);

  // Opportunities are read from the database by slug; courses are in the app.
  const queries = useQueries({
    queries: (group === "opportunity" ? ids : []).map((id) => ({
      queryKey: ["compare", "opportunity", id],
      queryFn: () => getOpportunity(id),
      staleTime: 60_000,
      retry: 1,
    })),
  });
  const loading = queries.some((q) => q.isPending);
  const opps = queries.map((q) => q.data).filter((o): o is Opportunity => !!o);
  const picked = ids.map((id) => courses.find((c) => c.id === id)).filter((c) => c !== undefined);

  const loadedIds = group === "course" ? picked.map((c) => c.id) : opps.map((o) => o.slug);
  const missing = loading ? [] : ids.filter((id) => !loadedIds.includes(id));
  const kind: CompareKind =
    group === "course"
      ? "course"
      : (opps[0]?.kind ?? shortOpp[0]?.kind ?? (fromLink && fromLink.ok ? fromLink.kind : "job"));

  const columns = group === "course" ? courseColumns(picked) : opportunityColumns(opps);
  const rows =
    group === "course"
      ? courseRows(picked, tx, {
          feeLine,
          startLine,
          hoursPerWeek,
          orgName: (id) => orgById(id).name,
        })
      : opportunityRows(opps, tx);

  const syncUrl = (rest: string[]) => {
    if (!fromUrl) return;
    void navigate({
      to: "/compare",
      search: rest.length ? { kind, ids: rest.join(",") } : {},
      replace: true,
    });
  };

  function remove(id: string, title: string) {
    removeCompareItem(group, id);
    syncUrl(ids.filter((x) => x !== id));
    setNote(`${title} ${tx("removed from the comparison")}`);
    focusTable();
  }

  function clearAll() {
    clearCompareGroup(group);
    syncUrl([]);
    setNote(tx("Comparison cleared"));
  }

  const linkIds = loadedIds;
  const canShare = linkIds.length >= COMPARE_MIN;
  const url = () => `${window.location.origin}${compareHref(kind, linkIds)}`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url());
      setCopy("copied");
    } catch {
      // No clipboard (an insecure page, a locked-down browser): show it to select.
      setCopy("manual");
      requestAnimationFrame(() => manual.current?.select());
    }
  }

  const addMore = group === "course" ? "/courses" : "/jobs";
  const ready = !loading && columns.length >= COMPARE_MIN;
  // Nothing picked yet: the page offers all three, so the heading names all three.
  // Jobs and internships compare with each other; courses compare with courses.
  const heading =
    !loading && columns.length === 0
      ? tx("Compare jobs, internships and courses")
      : group === "course"
        ? tx("Compare courses")
        : tx("Compare jobs and internships");

  return (
    <div className="container-x pb-24 pt-32">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SloganPlate tone="saffron">{tx("Compare")}</SloganPlate>
            <h1 className="section-title mt-4">{heading}</h1>
            <BlockPrintRule className="mt-5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={addMore} className="btn-ghost !min-h-[44px] !py-2.5 !text-xs">
              <ArrowLeft size={14} aria-hidden /> {tx("Add another")}
            </Link>
            {canShare && (
              <button
                type="button"
                onClick={copyLink}
                className="btn-ghost !min-h-[44px] !py-2.5 !text-xs"
              >
                {copy === "copied" ? (
                  <Check size={14} aria-hidden />
                ) : (
                  <Link2 size={14} aria-hidden />
                )}{" "}
                {copy === "copied" ? tx("Link copied") : tx("Copy link")}
              </button>
            )}
            {(shortlist.length > 0 || fromUrl) && (
              <button
                type="button"
                onClick={clearAll}
                className="btn-ghost !min-h-[44px] !py-2.5 !text-xs"
              >
                {tx("Clear all")}
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {copy === "manual" && canShare && (
        <div className="mt-4">
          <label className="font-body text-[12.5px] font-semibold text-ink-mute" htmlFor="cmp-link">
            {tx("Copy this link to share the comparison")}
          </label>
          <input
            id="cmp-link"
            ref={manual}
            readOnly
            value={url()}
            onFocus={(e) => e.currentTarget.select()}
            className="input mt-1 w-full"
          />
        </div>
      )}

      {missing.length > 0 && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-ink-line bg-paper-light p-4 font-body text-[13.5px] text-ink"
        >
          <p>{tx("These are no longer listed, so they cannot be compared:")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <code className="rounded bg-paper-dim px-1.5 py-0.5 text-[12px]">{id}</code>
                <button
                  type="button"
                  className="cmp-remove !m-0"
                  aria-label={`${tx("Remove")} ${id} ${tx("from comparison")}`}
                  onClick={() => remove(id, id)}
                >
                  {tx("Remove")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <p role="status" className="font-body text-[14px] text-ink-mute">
            {tx("Loading the comparison…")}
          </p>
        ) : ready ? (
          <>
            <p className="mb-3 font-body text-[13px] text-ink-mute">
              {tx(
                "Rows tagged Differs are where these are not the same. Scroll sideways to see every column.",
              )}
            </p>
            <CompareTable
              caption={`${heading}: ${columns.map((c) => c.title).join(", ")}`}
              columns={columns}
              rows={rows}
              onRemove={(id) => remove(id, columns.find((c) => c.id === id)?.title ?? id)}
            />
          </>
        ) : (
          <div id={COMPARE_FOCUS_ID} tabIndex={-1} className="max-w-xl outline-none">
            <h2 className="font-display text-2xl text-ink">{tx("Pick at least two to compare")}</h2>
            <p className="mt-3 font-body text-[15px] text-ink-mute">
              {columns.length === 1
                ? `${tx("You have picked")} ${columns[0]!.title}. ${tx("Tick Compare on one or two more and they will line up here.")}`
                : tx(
                    "Tick Compare on two or three jobs, internships or courses and they will line up here.",
                  )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/jobs" className="btn-primary !min-h-[44px]">
                {tx("Browse jobs")}
              </Link>
              <Link to="/internships" className="btn-ghost !min-h-[44px]">
                {tx("Browse internships")}
              </Link>
              <Link to="/courses" className="btn-ghost !min-h-[44px]">
                {tx("Browse courses")}
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
