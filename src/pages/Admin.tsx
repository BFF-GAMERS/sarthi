import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  approveAccount,
  deleteAccount,
  getSession,
  listAccounts,
  register,
  resetPassword,
  updateAccount,
  type Account,
  type ClassLevel,
  type Role,
  type Session,
} from "../lib/auth";
import { clearEvents, getEvents } from "../lib/activity";
import { setItem } from "../lib/store";
import AdminCourses from "../components/AdminCourses";

const ROLES: Role[] = ["student", "teacher", "volunteer", "parent", "admin"];
const CREATE_ROLES: Exclude<Role, "admin">[] = ["teacher", "volunteer", "parent", "student"];
const CLASS_LEVELS: ClassLevel[] = [8, 9, 10, 11, 12];

type Result = { ok: boolean; error?: string };

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN");
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
}

export default function Admin() {
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [error, setError] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [events, setEvents] = useState(() => getEvents());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<Role>("student");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<Exclude<Role, "admin">>("student");
  const [createClass, setCreateClass] = useState<ClassLevel>(8);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const session = getSession();
  if (!session || session.role !== "admin") {
    return (
      <section className="container-x py-10">
        <div className="card p-6">
          <p>Yeh page sirf admin ke liye hai. Aapke paas is page ki permission nahi hai.</p>
          <p className="mt-4">
            <Link to="/dashboard" className="btn-primary">
              Dashboard par jaayein
            </Link>
          </p>
        </div>
      </section>
    );
  }

  function reload() {
    setAccounts(listAccounts());
    setEvents(getEvents());
  }

  function report(result: Result) {
    setError(result.ok ? null : result.error ?? "Kuch galat ho gaya. Dobara try karein.");
    reload();
  }

  function handleRole(id: string, role: Role) {
    report(updateAccount(id, { role }));
  }

  function handleName(id: string, name: string, current: string) {
    if (name.trim() === current.trim()) return;
    report(updateAccount(id, { name }));
  }

  async function handleReset(id: string) {
    const result = await resetPassword(id, newPassword);
    if (result.ok) {
      setResetId(null);
      setNewPassword("");
    }
    report(result);
  }

  function handleDelete(id: string, email: string) {
    if (!window.confirm(`${email} ka account delete karna hai?`)) return;
    if (resetId === id) setResetId(null);
    report(deleteAccount(id));
  }

  function handleBackup() {
    const safe = accounts.map((a) => {
      const copy: Partial<Account> = { ...a };
      delete copy.passwordHash;
      return copy;
    });
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `swyam-accounts-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleClearLog() {
    if (!window.confirm("Activity log clear karna hai?")) return;
    clearEvents();
    setEvents([]);
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id),
    );
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? visible.map((a) => a.id) : []);
  }

  function handleBulkApply() {
    if (selectedIds.length === 0) {
      setError("Pehle koi account select karein.");
      return;
    }
    const failed = selectedIds.map((id) => updateAccount(id, { role: bulkRole })).filter((r) => !r.ok);
    setError(failed.length > 0 ? `${failed.length} account update nahi hue: ${failed[0].error ?? ""}` : null);
    setSelectedIds([]);
    reload();
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) {
      setError("Pehle koi account select karein.");
      return;
    }
    if (!window.confirm(`${selectedIds.length} accounts delete karne hain?`)) return;
    const failed = selectedIds.map((id) => deleteAccount(id)).filter((r) => !r.ok);
    if (resetId && selectedIds.includes(resetId)) setResetId(null);
    setError(failed.length > 0 ? `${failed.length} account delete nahi hue: ${failed[0].error ?? ""}` : null);
    setSelectedIds([]);
    reload();
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const adminSession: Session | null = getSession();
    const result = await register({
      name: createName,
      email: createEmail,
      password: createPassword,
      role: createRole,
      classLevel: createRole === "student" ? createClass : undefined,
      language: "hinglish",
    });
    // register() logs the new account in when it is not pending; put the admin session back.
    if (adminSession) setItem<Session>("session", adminSession);
    if (!result.ok) {
      setCreateMsg(null);
      setCreateError(result.error);
      return;
    }
    setCreateError(null);
    setCreateMsg(`${result.account.email} ka account ban gaya.`);
    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    reload();
  }

  function handleApprove(id: string) {
    report(approveAccount(id));
  }

  const counts: Record<Role, number> = {
    student: 0,
    teacher: 0,
    volunteer: 0,
    parent: 0,
    admin: 0,
  };
  for (const a of accounts) {
    if (a.role in counts) counts[a.role] += 1;
  }

  const loginEvents = events.filter((e) => e.type === "login");
  const loginsToday = loginEvents.filter((e) => isToday(e.at)).length;
  const pending = accounts.filter((a) => a.status === "pending");

  const query = search.trim().toLowerCase();
  const visible = accounts.filter((a) => {
    if (roleFilter !== "all" && a.role !== roleFilter) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query) || a.email.toLowerCase().includes(query);
  });
  const allVisibleSelected = visible.length > 0 && visible.every((a) => selectedIds.includes(a.id));

  return (
    <section className="container-x py-10">
      <p className="kicker">Admin</p>
      <h1 className="type-xl mt-2">Admin panel</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="card p-4">
          <p className="text-sm">Total accounts</p>
          <p className="text-2xl font-semibold">{accounts.length}</p>
        </div>
        {ROLES.map((r) => (
          <div key={r} className="card p-4">
            <p className="text-sm capitalize">{r}</p>
            <p className="text-2xl font-semibold">{counts[r]}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Stats</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm">Total accounts</p>
            <p className="text-2xl font-semibold">{accounts.length}</p>
          </div>
          <div>
            <p className="text-sm">Login events aaj</p>
            <p className="text-2xl font-semibold">{loginsToday}</p>
          </div>
          <div>
            <p className="text-sm">Total login events</p>
            <p className="text-2xl font-semibold">{loginEvents.length}</p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {ROLES.map((r) => {
            const pct = accounts.length > 0 ? Math.round((counts[r] / accounts.length) * 100) : 0;
            return (
              <div key={r} className="flex items-center gap-3 text-sm">
                <span className="w-24 capitalize">{r}</span>
                <div className="h-3 flex-1 rounded bg-black/10">
                  <div className="h-3 rounded bg-current" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right">{counts[r]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Pending approvals</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm">Koi pending approval nahi hai.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {pending.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3">
                <span>
                  {a.name} · {a.email} · {a.role}
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  aria-label={`Approve ${a.email}`}
                  onClick={() => handleApprove(a.id)}
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="card mt-6 p-6" onSubmit={(e) => void handleCreate(e)}>
        <h2 className="text-lg font-semibold">Naya account banayein</h2>
        {createError && (
          <p role="alert" className="mt-3 text-sm">
            {createError}
          </p>
        )}
        {createMsg && <p className="mt-3 text-sm">{createMsg}</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          <div>
            <label htmlFor="create-name" className="text-sm">
              Naam
            </label>
            <input
              id="create-name"
              className="input"
              value={createName}
              required
              onChange={(e) => setCreateName(e.currentTarget.value)}
            />
          </div>
          <div>
            <label htmlFor="create-email" className="text-sm">
              Email
            </label>
            <input
              id="create-email"
              type="email"
              className="input"
              value={createEmail}
              required
              onChange={(e) => setCreateEmail(e.currentTarget.value)}
            />
          </div>
          <div>
            <label htmlFor="create-password" className="text-sm">
              Password (kam se kam 6)
            </label>
            <input
              id="create-password"
              type="password"
              className="input"
              value={createPassword}
              minLength={6}
              required
              onChange={(e) => setCreatePassword(e.currentTarget.value)}
            />
          </div>
          <div>
            <label htmlFor="create-role" className="text-sm">
              Role
            </label>
            <select
              id="create-role"
              className="input"
              value={createRole}
              onChange={(e) => setCreateRole(e.currentTarget.value as Exclude<Role, "admin">)}
            >
              {CREATE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {createRole === "student" && (
            <div>
              <label htmlFor="create-class" className="text-sm">
                Class
              </label>
              <select
                id="create-class"
                className="input"
                value={createClass}
                onChange={(e) => setCreateClass(Number(e.currentTarget.value) as ClassLevel)}
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button type="submit" className="btn-primary mt-4">
          Account banayein
        </button>
      </form>

      <div className="card mt-6 p-6">
        {error && (
          <p role="alert" className="mb-4 text-sm">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="input"
            placeholder="Naam ya email se search karein"
            value={search}
            aria-label="Search accounts"
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <select
            className="input"
            value={roleFilter}
            aria-label="Filter by role"
            onChange={(e) => setRoleFilter(e.currentTarget.value as "all" | Role)}
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost"
            aria-label="Download accounts backup"
            onClick={handleBackup}
          >
            Download backup
          </button>
          <p className="text-sm">
            Showing {visible.length} of {accounts.length}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Select all accounts"
              checked={allVisibleSelected}
              onChange={(e) => handleSelectAll(e.currentTarget.checked)}
            />
            Sab select karein
          </label>
          <select
            className="input"
            value={bulkRole}
            aria-label="Bulk role"
            onChange={(e) => setBulkRole(e.currentTarget.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost" onClick={handleBulkApply}>
            Apply
          </button>
          <button type="button" className="btn-ghost" onClick={handleBulkDelete}>
            Delete selected
          </button>
          <p className="text-sm">{selectedIds.length} selected</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4">Select</th>
                <th scope="col" className="py-2 pr-4">Name</th>
                <th scope="col" className="py-2 pr-4">Email</th>
                <th scope="col" className="py-2 pr-4">Role</th>
                <th scope="col" className="py-2 pr-4">Created</th>
                <th scope="col" className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4">
                    Koi account nahi mila
                  </td>
                </tr>
              )}
              {visible.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${a.email}`}
                      checked={selectedIds.includes(a.id)}
                      onChange={(e) => toggleSelected(a.id, e.currentTarget.checked)}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      key={a.name}
                      className="input"
                      defaultValue={a.name}
                      aria-label={`Name for ${a.email}`}
                      onBlur={(e) => handleName(a.id, e.currentTarget.value, a.name)}
                    />
                  </td>
                  <td className="py-2 pr-4">{a.email}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="input"
                      value={a.role}
                      aria-label={`Role for ${a.email}`}
                      onChange={(e) => handleRole(a.id, e.currentTarget.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">{formatDate(a.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {resetId === a.id ? (
                        <>
                          <input
                            type="password"
                            className="input"
                            value={newPassword}
                            aria-label={`New password for ${a.email}`}
                            onChange={(e) => setNewPassword(e.currentTarget.value)}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => void handleReset(a.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              setResetId(null);
                              setNewPassword("");
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setResetId(a.id);
                            setNewPassword("");
                          }}
                        >
                          Reset password
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleDelete(a.id, a.email)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-semibold">Course management</h2>
        <p className="mt-2 text-sm">
          Hide aur title ke badlav save hote hain, lekin public course pages par abhi apply nahi hue hain.
        </p>
        <div className="mt-4">
          <AdminCourses />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Activity log</h2>
          <button
            type="button"
            className="btn-ghost"
            aria-label="Clear activity log"
            disabled={events.length === 0}
            onClick={handleClearLog}
          >
            Clear log
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-sm">Abhi koi activity nahi hai.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="py-2 pr-4">Time</th>
                  <th scope="col" className="py-2 pr-4">Type</th>
                  <th scope="col" className="py-2 pr-4">Actor</th>
                  <th scope="col" className="py-2 pr-4">Target</th>
                  <th scope="col" className="py-2 pr-4">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="align-top">
                    <td className="py-2 pr-4">{formatDateTime(ev.at)}</td>
                    <td className="py-2 pr-4">{ev.type}</td>
                    <td className="py-2 pr-4">{ev.actor}</td>
                    <td className="py-2 pr-4">{ev.target}</td>
                    <td className="py-2 pr-4">{ev.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
