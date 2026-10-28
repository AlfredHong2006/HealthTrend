/**
 * Static guard: no browser persistence mechanism may appear anywhere in this frontend's
 * source. This is the frontend equivalent of the backend's
 * `backend/tests/core/test_architecture_purity.py` -- a scan enforced by a test rather than
 * relying on review, because "nothing here needs it" is a stronger guarantee than a policy
 * only once something actually checks it (docs/privacy.md).
 *
 * Deliberately a plain text scan over `.ts`/`.tsx` source, not an AST-aware analysis: simple
 * enough to trust, and every one of the mechanisms below has one unambiguous spelling in
 * source code, so a substring/regex match is exactly as reliable as a parser would be here.
 * The cookie check matches bare `document.cookie` (read or write) rather than only an `=`
 * assignment, since nothing in this frontend has a legitimate reason to touch it either way,
 * and a narrower pattern (e.g. matching only `document.cookie =`) misses `+=` and other
 * compound writes for no real benefit.
 *
 * One exception, named below and nowhere else: `lib/theme/theme.ts` may use `localStorage`, for
 * the light/dark appearance choice only. That is a single non-personal word, kept in the browser
 * because the public pages have no account to hold it; it is not measurement data, not account
 * state, and is sent to no server. The exception is to one mechanism in one file, and a second
 * test pins what that file may do with it, so it cannot quietly widen into general storage.
 *
 * Scoped to `frontend/src`, excluding this file (whose own text necessarily names what it
 * forbids) and the generated OpenAPI schema (describes a wire contract, not browser storage).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(import.meta.dirname, "../../../");
const THIS_FILE = path.resolve(import.meta.dirname, "no-persistence.test.ts");
const EXCLUDED_BASENAMES = new Set(["schema.d.ts"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

interface ForbiddenMechanism {
  name: string;
  pattern: RegExp;
}

const FORBIDDEN: ForbiddenMechanism[] = [
  { name: "localStorage", pattern: /localStorage/ },
  { name: "sessionStorage", pattern: /sessionStorage/ },
  { name: "IndexedDB", pattern: /indexedDB/i },
  { name: "document.cookie", pattern: /document\.cookie/ },
  { name: "the Cache API", pattern: /\bcaches\.(open|match|delete|keys|has)\s*\(/ },
  { name: "navigator.storage", pattern: /navigator\.storage\b/ },
];

/** File (relative to `src`, forward slashes) -> the mechanisms it alone may use. */
const ALLOWED: Record<string, readonly string[]> = {
  "lib/theme/theme.ts": ["localStorage"],
};

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (
      full !== THIS_FILE &&
      !EXCLUDED_BASENAMES.has(entry) &&
      SOURCE_EXTENSIONS.has(path.extname(entry))
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("no browser persistence in frontend source", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("scans a real, non-trivial set of files, or this guard is checking nothing", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const mechanism of FORBIDDEN) {
    it(`introduces no use of ${mechanism.name}`, () => {
      const offenders = files
        .filter((file) => mechanism.pattern.test(readFileSync(file, "utf-8")))
        .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join("/"))
        .filter((file) => !(ALLOWED[file] ?? []).includes(mechanism.name));
      expect(offenders).toEqual([]);
    });
  }
});

describe("the one storage exception stays as narrow as it was granted", () => {
  const source = readFileSync(path.join(SRC_ROOT, "lib/theme/theme.ts"), "utf-8");

  it("is the only allowed file, for the only allowed mechanism", () => {
    expect(ALLOWED).toEqual({ "lib/theme/theme.ts": ["localStorage"] });
  });

  it("only ever reads or writes the single theme key", () => {
    const calls = [...source.matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, method, args] of calls) {
      expect(["getItem", "setItem"]).toContain(method);
      expect(args).toContain("THEME_STORAGE_KEY");
    }
    // Every mention is one of those calls: no aliasing the store, no iterating its keys.
    expect(source.match(/localStorage(?!\.(getItem|setItem)\()/g) ?? []).toEqual([]);
  });

  it("can only store the words light and dark", () => {
    expect(source).toMatch(/export type Theme = "light" \| "dark";/);
    expect(source).toMatch(/setItem\(THEME_STORAGE_KEY, theme\)/);
  });
});
