import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import {
  CONTENT_TABLES,
  createRow,
  deleteRow,
  listRows,
  toMinor,
  toRupees,
  updateRow,
  type ContentTable,
  type FieldSpec,
  type Row,
} from "../lib/admin-content";
import { useTx } from "../lib/i18n";

/**
 * The catalogue tables that had no editor.
 *
 * Openings, skills, career paths, groups, reward offers and badges could all be
 * read by the admin area and changed by none of it — the only way to edit any
 * of them was to write SQL by hand. One editor renders all of them from the
 * description in `admin-content.ts`, so adding a seventh table is a config
 * entry rather than another screen to keep in step with this one.
 */
export default function AdminContent({ onNote }: { onNote: (t: "ok" | "bad", m: string) => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [tableName, setTableName] = useState(CONTENT_TABLES[0]!.table);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const spec = CONTENT_TABLES.find((t) => t.table === tableName)!;

  const rows = useQuery({
    queryKey: ["admin-content", tableName, search],
    queryFn: () => listRows(spec, search),
  });

  const settle = (msg: string) => {
    onNote("ok", msg);
    setEditingId(null);
    setCreating(false);
    void qc.invalidateQueries({ queryKey: ["admin-content", tableName] });
  };

  const save = useMutation({
    mutationFn: (v: { id: string; patch: Row }) => updateRow(spec, v.id, v.patch),
    onSuccess: () => settle("Saved."),
    onError: (e: Error) => onNote("bad", e.message),
  });

  const add = useMutation({
    mutationFn: (values: Row) => createRow(spec, values),
    onSuccess: () => settle("Created."),
    onError: (e: Error) => onNote("bad", e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRow(spec, id),
    onSuccess: () => settle("Deleted."),
    onError: (e: Error) => onNote("bad", e.message),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {CONTENT_TABLES.map((t) => (
          <button
            key={t.table}
            onClick={() => {
              setTableName(t.table);
              setEditingId(null);
              setCreating(false);
              setSearch("");
            }}
            aria-pressed={t.table === tableName}
            className="filter-pill"
          >
            {tx(t.label)}
          </button>
        ))}
      </div>

      <p className="mt-3 font-body text-[13px] text-ink-mute">{tx(spec.note)}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx("Search by name")}
            aria-label={tx("Search by name")}
            className="input !py-2 !pl-9"
          />
        </label>
        {spec.canCreate && !creating && (
          <button
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="btn-primary shrink-0 !py-2 !text-xs"
          >
            <Plus size={14} aria-hidden /> {tx("New")}
          </button>
        )}
      </div>

      {creating && (
        <div className="card-flat mt-4 p-4">
          <RowForm
            spec={spec}
            row={{}}
            busy={add.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(values) => add.mutate(values)}
          />
        </div>
      )}

      {rows.isLoading && <p className="mt-6 font-body text-sm text-ink-mute">{tx("Loading…")}</p>}
      {rows.isError && (
        <p className="mt-6 font-body text-sm text-danger">{(rows.error as Error).message}</p>
      )}
      {rows.data && rows.data.length === 0 && (
        <p className="mt-6 font-body text-sm text-ink-mute">{tx("Nothing here yet.")}</p>
      )}

      <ul className="mt-4 space-y-2">
        {(rows.data ?? []).map((r) => {
          const id = String(r["id"]);
          const open = editingId === id;
          const subtitle = spec.subtitleKeys
            .map((k) => r[k])
            .filter((v) => v !== null && v !== undefined && v !== "")
            .join(" · ");
          return (
            <li key={id} className="card-flat p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-ink">
                    {String(r[spec.titleKey] ?? "—")}
                  </p>
                  <p className="mt-0.5 font-body text-[12px] text-ink-mute">{subtitle || "—"}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingId(open ? null : id);
                    setCreating(false);
                  }}
                  className="btn-ghost shrink-0 !px-3 !py-2 !text-[11px]"
                >
                  {open ? tx("Close") : tx("Edit")}
                </button>
                {spec.canDelete && (
                  <button
                    onClick={() => remove.mutate(id)}
                    className="btn-ghost shrink-0 !px-3 !py-2 !text-[11px]"
                    aria-label={tx("Delete")}
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                )}
              </div>
              {open && (
                <RowForm
                  spec={spec}
                  row={r}
                  busy={save.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(patch) => save.mutate({ id, patch })}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * One form for every table.
 *
 * On edit it submits only the fields that changed. Writing every field back
 * would overwrite a column somebody else edited since this screen loaded, and
 * would trip a check constraint on a field nobody had touched.
 */
function RowForm({
  spec,
  row,
  busy,
  onCancel,
  onSubmit,
}: {
  spec: ContentTable;
  row: Row;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: Row) => void;
}) {
  const tx = useTx();
  const creating = row["id"] === undefined;

  const shown = (f: FieldSpec, raw: unknown): string =>
    f.type === "money" ? toRupees(raw) : raw === null || raw === undefined ? "" : String(raw);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of spec.fields) v[f.key] = shown(f, row[f.key]);
    return v;
  });

  const submit = () => {
    const out: Row = {};
    for (const f of spec.fields) {
      if (f.readOnly) continue;
      const now = values[f.key] ?? "";
      if (!creating && now === shown(f, row[f.key])) continue;

      if (f.type === "money") out[f.key] = toMinor(now);
      else if (f.type === "number") out[f.key] = now.trim() === "" ? null : Number(now);
      else if (f.type === "bool") out[f.key] = now === "true";
      else out[f.key] = now.trim() === "" ? null : now;
    }
    onSubmit(out);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={creating ? "" : "mt-4 border-t border-ink-line pt-4"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spec.fields.map((f) => (
          <Field
            key={f.key}
            f={f}
            value={values[f.key] ?? ""}
            onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-primary !py-2 !text-xs">
          {busy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Check size={13} aria-hidden />
          )}
          {creating ? tx("Create") : tx("Save")}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost !py-2 !text-xs">
          {tx("Cancel")}
        </button>
      </div>
    </form>
  );
}

function Field({
  f,
  value,
  onChange,
}: {
  f: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  const tx = useTx();

  const help = f.help ? (
    <span className="mt-1 block font-body text-[11px] leading-snug text-ink-mute">
      {tx(f.help)}
    </span>
  ) : null;

  if (f.type === "bool") {
    return (
      <label className="flex items-start gap-2.5 sm:col-span-2">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-line accent-saffron-500"
        />
        <span className="min-w-0">
          <span className="font-body text-[13px] font-medium text-ink">{tx(f.label)}</span>
          {help}
        </span>
      </label>
    );
  }

  if (f.type === "select") {
    return (
      <label className="block">
        <span className="datum">{tx(f.label)}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input mt-1 !py-2"
        >
          <option value="">—</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  }

  if (f.type === "textarea") {
    return (
      <label className="block sm:col-span-2">
        <span className="datum">{tx(f.label)}</span>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input mt-1 resize-y"
        />
        {help}
      </label>
    );
  }

  return (
    <label className="block">
      <span className="datum">{tx(f.label)}</span>
      <input
        type={
          f.type === "number" || f.type === "money" ? "number" : f.type === "url" ? "url" : "text"
        }
        inputMode={f.type === "money" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 !py-2"
      />
      {help}
    </label>
  );
}
