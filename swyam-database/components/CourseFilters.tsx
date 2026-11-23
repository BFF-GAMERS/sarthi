import { useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import Portal from "./Portal";
import { useTx } from "../lib/i18n";
import { courses } from "../data/mock";
import {
  DEFAULT_FILTERS,
  SORTS,
  catalogueCities,
  countActive,
  type CourseFilters as Filters,
  type SortId,
} from "../lib/course-filters";
import CompareCheckbox from "./compare/CompareCheckbox";

/**
 * The catalogue's controls.
 *
 * On a laptop the filters sit in a row above the grid. On a phone the same
 * controls open as a sheet from the bottom, behind one button that says how
 * many are on — the brief calls it a bottom sheet, and it is one: it is
 * reached with the thumb, it scrolls if it must, and the Show button at its
 * foot says how many courses it will show before it is pressed.
 */

const CITIES = catalogueCities(courses);

function Group<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 font-body text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`filter-pill ${value === o.id ? "!bg-ink !text-paper" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`filter-pill ${on ? "!bg-ink !text-paper" : ""}`}
    >
      {label}
    </button>
  );
}

export function FilterControls({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const tx = useTx();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <Group
        label={tx("Price")}
        value={value.price}
        onChange={(v) => set("price", v)}
        options={[
          { id: "any", label: tx("Any") },
          { id: "free", label: tx("Free") },
          { id: "paid", label: tx("Paid") },
        ]}
      />
      <Group
        label={tx("Mode")}
        value={value.mode}
        onChange={(v) => set("mode", v)}
        options={[
          { id: "any", label: tx("Any") },
          { id: "Online", label: tx("Online") },
          { id: "Offline", label: tx("In person") },
          { id: "Hybrid", label: tx("Hybrid") },
        ]}
      />
      {CITIES.length > 0 && (
        <Group
          label={tx("City (in-person courses)")}
          value={value.city}
          onChange={(v) => set("city", v)}
          options={[{ id: "any", label: tx("Any") }, ...CITIES.map((c) => ({ id: c, label: c }))]}
        />
      )}
      <Group
        label={tx("Duration")}
        value={value.duration}
        onChange={(v) => set("duration", v)}
        options={[
          { id: "any", label: tx("Any") },
          { id: "short", label: tx("Up to a month") },
          { id: "medium", label: tx("1–3 months") },
          { id: "long", label: tx("Longer") },
        ]}
      />
      <Group
        label={tx("Level")}
        value={value.level}
        onChange={(v) => set("level", v)}
        options={[
          { id: "any", label: tx("Any") },
          { id: "Beginner", label: tx("Beginner") },
          { id: "Intermediate", label: tx("Intermediate") },
          { id: "Advanced", label: tx("Advanced") },
        ]}
      />
      <div>
        <p className="mb-1.5 font-body text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
          {tx("Also")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Toggle
            label={tx("Starting soon or any time")}
            on={value.startingSoon}
            onChange={(v) => set("startingSoon", v)}
          />
          <Toggle
            label={tx("Placement support")}
            on={value.placement}
            onChange={(v) => set("placement", v)}
          />
        </div>
      </div>
    </div>
  );
}

export function SortSelect({ value, onChange }: { value: SortId; onChange: (s: SortId) => void }) {
  const tx = useTx();
  return (
    <label className="inline-flex items-center gap-2 font-body text-[13px] text-ink-mute">
      {tx("Sort")}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortId)}
        className="input !w-auto !py-2 !text-[13px]"
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {tx(s.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The phone's filter button + bottom sheet. */
export function FilterSheet({
  value,
  onChange,
  open,
  onOpen,
  onClose,
  resultCount,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  resultCount: number;
}) {
  const tx = useTx();
  const n = countActive(value);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="filter-pill inline-flex items-center gap-1.5"
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={14} aria-hidden />
        {tx("Filters")}
        {n > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-saffron-500 px-1 text-[11px] font-semibold text-on-accent">
            {n}
          </span>
        )}
      </button>
      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-end bg-ink/60 backdrop-blur-sm"
            onClick={onClose}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={tx("Filters")}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-paper-light p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-line" aria-hidden />
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-ink">{tx("Filters")}</h2>
                <div className="flex items-center gap-3">
                  {n > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange(DEFAULT_FILTERS)}
                      className="font-body text-[12px] text-saffron-600 underline"
                    >
                      {tx("Clear")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-paper-dim"
                    aria-label={tx("Close")}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <FilterControls value={value} onChange={onChange} />
              </div>
              <button type="button" onClick={onClose} className="btn-primary mt-6 w-full">
                {tx("Show")} {resultCount} {resultCount === 1 ? tx("course") : tx("courses")}
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

/**
 * Kept so Courses.tsx still renders it. The tray now lives in one place for
 * every list — CompareDock, mounted once in the root — so this draws nothing.
 */
export function CompareTray() {
  return null;
}

/** The toggle on a card or a page: the shared Compare checkbox, for a course. */
export function CompareToggle({ id, className = "" }: { id: string; className?: string }) {
  const title = courses.find((c) => c.id === id)?.title ?? id;
  return <CompareCheckbox kind="course" id={id} title={title} className={className} />;
}
