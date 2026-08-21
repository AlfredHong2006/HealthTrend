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
        .map((file) => path.relative(SRC_ROOT, file));
      expect(offenders).toEqual([]);
    });
  }
});
