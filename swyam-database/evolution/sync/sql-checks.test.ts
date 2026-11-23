// The SQL CHECK lists must match config/ids.ts (a string test), the SQL must follow the house rules, and the
// pre-paint bootstrap script must read the same boot key the runtime writes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DECISION_SOURCES, BEHAVIOUR_MODES, EVOLUTION_STATES, TIERS } from "../config/ids";
import { PREFERENCES_BOOTSTRAP_SCRIPT } from "../../context/PreferencesContext";
import { BOOT_KEY } from "../platform/storage/keys";

const sql = readFileSync(new URL("../../../db/025_evolution_profile.sql", import.meta.url), "utf8");
const code = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

/** Every `<column> ... in ( 'a', 'b' )` list in the SQL, as sorted arrays, for one column. */
function listsFor(column: string): string[][] {
  const re = new RegExp(
    `\\b${column}\\s+(?:text\\s+not null\\s+)?check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`,
    "gi",
  );
  return [...code.matchAll(re)].map((m) =>
    [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!).sort(),
  );
}

const sorted = (xs: readonly (string | number)[]): string[] => xs.map(String).sort();

describe("db/025 CHECK lists are generated from ids.ts", () => {
  it("state, from_state and to_state use EVOLUTION_STATES exactly", () => {
    for (const col of ["state", "from_state", "to_state"]) {
      const lists = listsFor(col);
      expect(lists.length, col).toBeGreaterThan(0);
      for (const l of lists) expect(l, col).toEqual(sorted(EVOLUTION_STATES));
    }
  });

  it("mode uses BEHAVIOUR_MODES exactly", () => {
    const lists = listsFor("mode");
    expect(lists).toHaveLength(1);
    expect(lists[0]).toEqual(sorted(BEHAVIOUR_MODES));
  });

  it("source is DECISION_SOURCES without persona (demos never leave the device)", () => {
    const lists = listsFor("source");
    expect(lists).toHaveLength(1);
    expect(lists[0]).toEqual(sorted(DECISION_SOURCES.filter((s) => s !== "persona")));
    expect(lists[0]).not.toContain("persona");
  });

  it("tier accepts exactly TIERS", () => {
    const m = /tier\s+smallint[^,]*check\s*\(\s*tier\s+in\s*\(([^)]*)\)/i.exec(code);
    expect(m).not.toBeNull();
    expect(sorted(m![1]!.split(",").map((x) => x.trim()))).toEqual(sorted(TIERS));
  });
});

describe("db/025 house rules", () => {
  it("is one idempotent transaction", () => {
    expect(code).toMatch(/^\s*begin;/m);
    expect(code).toMatch(/^\s*commit;/m);
    expect(code).toMatch(/create table if not exists public\.evolution_profiles/);
    expect(code).toMatch(/create table if not exists public\.evolution_history/);
    for (const m of code.matchAll(/create policy "([^"]+)"/g))
      expect(code, m[1]).toContain(`drop policy if exists "${m[1]}"`);
    for (const m of code.matchAll(/create trigger (\w+)/g))
      expect(code, m[1]).toContain(`drop trigger if exists ${m[1]}`);
  });

  it("enables RLS on both tables, with own-row policies and no admin read", () => {
    expect(code).toMatch(/alter table public\.evolution_profiles enable row level security/);
    expect(code).toMatch(/alter table public\.evolution_history enable row level security/);
    expect(code).not.toMatch(/is_admin/);
    for (const m of code.matchAll(/create policy[\s\S]*?;\s*(?=\n\s*\n|drop|grant)/g))
      expect(m[0]).toMatch(/profile_id = \(select auth\.uid\(\)\)/);
  });

  it("guards minors in every insert and update check", () => {
    const writes = [...code.matchAll(/for (?:insert|update)[\s\S]*?with check \(([\s\S]*?)\);/g)];
    expect(writes.length).toBe(3);
    for (const w of writes) expect(w[1]).toMatch(/is_minor/);
  });

  it("has explicit grants, a set_updated_at trigger, the caps and a commented check query", () => {
    expect(code).toMatch(
      /grant select, insert, update, delete on table public\.evolution_profiles to authenticated/,
    );
    expect(code).toMatch(
      /grant select, insert, delete on table public\.evolution_history to authenticated/,
    );
    expect(code).toMatch(/evolution_set_updated_at/);
    expect(code).toMatch(/>= 100/); // at most 100 inserts a day
    expect(code).toMatch(/offset 50/); // 50 history rows kept
    expect(code).toMatch(/char_length\(reason\) <= 200/);
    expect(code).toMatch(/octet_length\(scores::text\) <= 2048/);
    expect(code).toMatch(/octet_length\(action_counts::text\) <= 4096/);
    expect(sql).toMatch(/^-- select .*evolution_profiles/m);
  });

  it("does not depend on RUN-ME-PENDING.sql objects", () => {
    expect(code).not.toMatch(/public\.(notify|is_admin|set_updated_at)\b/);
  });
});

describe("the pre-paint bootstrap", () => {
  it("reads swayam.evo.boot and stamps the five data-evo attributes inside its own try/catch", () => {
    expect(PREFERENCES_BOOTSTRAP_SCRIPT).toContain(`localStorage.getItem('${BOOT_KEY}')`);
    for (const attr of ["evoState", "evoNav", "evoLayout", "evoDensity", "evoTier"])
      expect(PREFERENCES_BOOTSTRAP_SCRIPT).toContain(`dataset.${attr}`);
    const evo = PREFERENCES_BOOTSTRAP_SCRIPT.slice(
      PREFERENCES_BOOTSTRAP_SCRIPT.indexOf(BOOT_KEY) - 120,
    );
    expect(evo).toMatch(/try\{[\s\S]*\}catch\(e\)\{\}/);
  });

  it("is valid JavaScript and survives a missing, corrupt or hostile boot hint", () => {
    const run = (boot: string | null) => {
      const dataset: Record<string, string> = {};
      const root = { dataset, style: { setProperty() {} }, lang: "", dir: "" };
      const store: Record<string, string> = {};
      if (boot !== null) store[BOOT_KEY] = boot;
      const fn = new Function(
        "document",
        "localStorage",
        "window",
        "navigator",
        PREFERENCES_BOOTSTRAP_SCRIPT,
      );
      fn(
        { documentElement: root },
        { getItem: (k: string) => store[k] ?? null },
        { matchMedia: () => ({ matches: false }) },
        {},
      );
      return dataset;
    };
    const good = run(
      JSON.stringify({
        v: 1,
        state: "CAREER_FIRST",
        nav: "CAREER_PRIORITY",
        layout: "CAREER_DISCOVERY",
        density: "standard",
        tier: 3,
      }),
    );
    expect(good).toMatchObject({
      evoState: "CAREER_FIRST",
      evoNav: "CAREER_PRIORITY",
      evoLayout: "CAREER_DISCOVERY",
      evoDensity: "standard",
      evoTier: "3",
    });
    expect(run(null)["evoState"]).toBeUndefined();
    expect(run("{corrupt")["evoState"]).toBeUndefined();
    expect(
      run(JSON.stringify({ v: 1, state: "<script>", nav: "x", layout: "y", density: "z" }))[
        "evoState"
      ],
    ).toBeUndefined();
    expect(
      run(JSON.stringify({ v: 2, state: "CAREER_FIRST", nav: "a", layout: "b", density: "c" }))[
        "evoState"
      ],
    ).toBeUndefined();
    // the preferences half still ran in every case
    expect(run("{corrupt")["mode"]).toBeDefined();
  });
});
