import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useTx } from "../../lib/i18n";
import type { CompareColumn, CompareRow } from "../../lib/compare-fields";

/**
 * Items side by side as a real table.
 *
 * One column per item, one row per fact, the row labels in a column that
 * stays put while the items scroll under it. Rows where the items disagree
 * carry a bar and the word "Differs"; a "best" hint is words in the cell, so
 * nothing is said by colour alone. The wrapper scrolls sideways on its own
 * (focusable, so the keyboard can do it); the page never does.
 */

export const COMPARE_FOCUS_ID = "cmp-focus-target";

function Open({ col }: { col: CompareColumn }) {
  const tx = useTx();
  const label = col.kind === "course" ? tx("View & enroll") : tx("View & apply");
  const sr = <span className="sr-only"> {col.title}</span>;
  const cls = "btn-primary cmp-open !py-2.5 !text-xs";
  if (col.kind === "course") {
    return (
      <Link to="/courses/$id" params={{ id: col.id }} className={cls}>
        {label}
        {sr} <ArrowRight size={14} aria-hidden />
      </Link>
    );
  }
  if (col.kind === "internship") {
    return (
      <Link to="/internships/$id" params={{ id: col.id }} className={cls}>
        {label}
        {sr} <ArrowRight size={14} aria-hidden />
      </Link>
    );
  }
  return (
    <Link to="/jobs/$id" params={{ id: col.id }} className={cls}>
      {label}
      {sr} <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

function Title({ col }: { col: CompareColumn }) {
  const cls = "cmp-title";
  if (col.kind === "course") {
    return (
      <Link to="/courses/$id" params={{ id: col.id }} className={cls}>
        {col.title}
      </Link>
    );
  }
  if (col.kind === "internship") {
    return (
      <Link to="/internships/$id" params={{ id: col.id }} className={cls}>
        {col.title}
      </Link>
    );
  }
  return (
    <Link to="/jobs/$id" params={{ id: col.id }} className={cls}>
      {col.title}
    </Link>
  );
}

export default function CompareTable({
  caption,
  columns,
  rows,
  onRemove,
}: {
  caption: string;
  columns: CompareColumn[];
  rows: CompareRow[];
  onRemove: (id: string) => void;
}) {
  const tx = useTx();
  const n = columns.length;

  return (
    <div
      id={COMPARE_FOCUS_ID}
      className="cmp-scroll"
      tabIndex={0}
      role="region"
      aria-label={tx("Comparison table, scroll sideways")}
    >
      <table className="cmp-table" style={{ ["--cmp-cols" as string]: n }}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="cmp-labelcol" />
          {columns.map((c) => (
            <col key={c.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td className="cmp-corner">
              <span className="sr-only">{tx("What is compared")}</span>
            </td>
            {columns.map((c) => (
              <th key={c.id} scope="col" className="cmp-colhead">
                <Title col={c} />
                {c.subtitle && <p className="cmp-sub">{c.subtitle}</p>}
                <button
                  type="button"
                  className="cmp-remove"
                  aria-label={`${tx("Remove")} ${c.title} ${tx("from comparison")}`}
                  onClick={() => onRemove(c.id)}
                >
                  <X size={14} aria-hidden /> {tx("Remove")}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.differs ? "cmp-differs" : undefined}>
              <th scope="row" className="cmp-rowhead">
                {r.label}
                {r.differs && (
                  <>
                    <br />
                    <span className="cmp-tag" aria-hidden>
                      {tx("Differs")}
                    </span>
                    <span className="sr-only">. {tx("Differs between these items")}</span>
                  </>
                )}
              </th>
              {r.span !== undefined ? (
                <td colSpan={n}>{r.span}</td>
              ) : (
                r.values.map((v, i) => (
                  <td key={columns[i]?.id ?? i}>
                    {v}
                    {r.best?.includes(i) && r.bestHint && (
                      <>
                        <br />
                        <span className="cmp-best">{r.bestHint}</span>
                      </>
                    )}
                  </td>
                ))
              )}
            </tr>
          ))}
          <tr>
            <th scope="row" className="cmp-rowhead">
              {tx("Next step")}
            </th>
            {columns.map((c) => (
              <td key={c.id}>
                <Open col={c} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
