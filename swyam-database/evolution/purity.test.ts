// Purity: the engine, the config and the helpers stay free of UI, routing, network and nondeterminism.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FORBIDDEN_IMPORT =
  /from\s+["'](react|react-dom|react\/[^"']*|framer-motion|motion\/[^"']*|@tanstack\/[^"']*|@supabase\/[^"']*|zustand[^"']*)["']/;
const FORBIDDEN_CALL =
  /Math\.random\s*\(|Date\.now\s*\(|new\s+Date\s*\(\s*\)|performance\.now\s*\(/;
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("purity of src/evolution/{core,config,lib}", () => {
  for (const dir of ["core", "config", "lib"]) {
    const files = walk(`${root}${dir}`);
    it(`${dir}: has files to check`, () => {
      expect(files.length).toBeGreaterThan(0);
    });
    for (const file of files) {
      const rel = file.slice(root.length);
      it(`${rel} imports no react, framer-motion, @tanstack/* or @supabase/*`, () => {
        expect(strip(readFileSync(file, "utf8"))).not.toMatch(FORBIDDEN_IMPORT);
      });
      it(`${rel} never reads the clock or randomness`, () => {
        expect(strip(readFileSync(file, "utf8"))).not.toMatch(FORBIDDEN_CALL);
      });
    }
  }

  it("core never touches the DOM or storage", () => {
    for (const file of walk(`${root}core`)) {
      const src = strip(readFileSync(file, "utf8"));
      expect(src, file).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator)\./);
      expect(src, file).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
