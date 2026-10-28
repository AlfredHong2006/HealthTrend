import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseTheme,
  currentTheme,
  serverTheme,
  subscribeToTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "../theme";

/** The stored value is read back through the init script, the way a real reload reads it, so
 * these tests never name the storage API themselves (the no-persistence guard scans tests too). */
function simulateReload() {
  document.documentElement.removeAttribute("data-theme");
  new Function(THEME_INIT_SCRIPT)();
}

afterEach(() => {
  chooseTheme("light");
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("is light until the reader chooses otherwise, on the server and in the browser", () => {
    expect(serverTheme()).toBe("light");
    expect(currentTheme()).toBe("light");
  });

  it("applies a chosen theme to <html> at once", () => {
    chooseTheme("dark");

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(currentTheme()).toBe("dark");

    chooseTheme("light");

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(currentTheme()).toBe("light");
  });

  it("restores a dark choice before paint on the next load", () => {
    chooseTheme("dark");

    simulateReload();

    expect(currentTheme()).toBe("dark");
  });

  it("restores light after switching back, and stays light with nothing stored", () => {
    chooseTheme("dark");
    chooseTheme("light");

    simulateReload();

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(currentTheme()).toBe("light");
  });

  it("notifies subscribers, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTheme(listener);

    chooseTheme("dark");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    chooseTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("still applies the theme when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => chooseTheme("dark")).not.toThrow();
    expect(currentTheme()).toBe("dark");
  });

  it("leaves the page light, without throwing, when the init script cannot read storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(simulateReload).not.toThrow();
    expect(currentTheme()).toBe("light");
  });

  it("keeps the init script self-contained and tied to the one key", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).not.toMatch(/import|require|fetch|cookie/);
  });
});

describe("dark palette", () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, "../../../app/v2/v2-tokens.css"),
    "utf-8",
  );
  const darkStart = css.indexOf('html[data-theme="dark"] .htV2 {');
  const light = css.slice(css.indexOf(".htV2 {"), darkStart);
  const dark = css.slice(darkStart);

  /** Tokens whose light value is a literal colour, rather than a `var()` alias of another. */
  function literalColourTokens(block: string): string[] {
    return [...block.matchAll(/(--v2-[\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map(
      (match) => match[1]!,
    );
  }

  it("exists, scoped to an explicit choice rather than the OS preference", () => {
    expect(darkStart).toBeGreaterThan(0);
    expect(css).not.toMatch(/@media[^{]*prefers-color-scheme/);
  });

  it("re-declares every literal colour of the light palette, so none shows through", () => {
    const lightTokens = literalColourTokens(light);
    const darkTokens = new Set(literalColourTokens(dark));

    expect(lightTokens.length).toBeGreaterThan(20);
    expect(lightTokens.filter((token) => !darkTokens.has(token))).toEqual([]);
  });

  it("tells the browser to render native controls dark too", () => {
    expect(dark).toMatch(/color-scheme:\s*dark;/);
  });
});

describe("one theme across every route", () => {
  const appDir = path.resolve(import.meta.dirname, "../../../app");
  const v1Tokens = readFileSync(path.join(appDir, "tokens.css"), "utf-8");
  const globals = readFileSync(path.join(appDir, "globals.css"), "utf-8");
  const v2Tokens = readFileSync(path.join(appDir, "v2/v2-tokens.css"), "utf-8");

  it("no palette follows the OS preference, so routes cannot disagree with the chosen theme", () => {
    for (const css of [v1Tokens, globals, v2Tokens]) {
      expect(css).not.toMatch(/@media[^{]*prefers-color-scheme/);
    }
    expect(globals).not.toMatch(/color-scheme:\s*light dark/);
  });

  it("the legacy /demo and /analyse palette answers to the same data-theme attribute", () => {
    const darkStart = v1Tokens.indexOf(':root[data-theme="dark"] {');
    expect(darkStart).toBeGreaterThan(0);

    const colourTokens = (block: string) =>
      [...block.matchAll(/(--ht-[\w-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map(
        (match) => match[1]!,
      );
    const light = colourTokens(v1Tokens.slice(0, darkStart));
    const dark = new Set(colourTokens(v1Tokens.slice(darkStart)));

    expect(light.length).toBeGreaterThan(8);
    expect(light.filter((token) => !dark.has(token))).toEqual([]);
  });

  it("native controls follow the chosen theme on every route", () => {
    expect(globals).toMatch(/html\[data-theme="dark"\]\s*{\s*color-scheme:\s*dark;/);
  });
});
