/**
 * The light / dark appearance choice, and the ONLY browser storage this frontend uses.
 *
 * Everything else here keeps nothing in the browser, and a static guard
 * (`src/lib/privacy/__tests__/no-persistence.test.ts`) fails the build if a storage API appears
 * anywhere under `src`. This file is that guard's single named exception, for a single value: the
 * word "light" or "dark" under one key. It is not account state and not health data, it is
 * never sent anywhere (unlike a cookie, the browser attaches it to no request), and it has to
 * live in the browser because the public `/v2` pages have no account to store it against and the
 * choice must already be known before the first paint (docs/privacy.md, "The frontend").
 *
 * The theme itself is one attribute, `data-theme` on `<html>`; `v2-tokens.css` re-declares the
 * `--v2-*` palette under it. Nothing reads the stored value except the two functions and the
 * inline script below.
 */

export type Theme = "light" | "dark";

export const THEMES: readonly Theme[] = ["light", "dark"];

/** Light is the design's own default and what a visitor who never chose gets. */
export const DEFAULT_THEME: Theme = "light";

export const THEME_STORAGE_KEY = "healthtrend-theme";

/**
 * Runs in `<head>` before first paint (`src/app/layout.tsx`), so a reader who chose dark never
 * sees a light page flash first. Plain ES5 and self-contained: it executes before any bundle. A
 * browser that refuses storage access throws, and the page simply stays light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="dark"){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;

const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: the theme lives on `<html>`, outside React. */
export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The theme currently applied to the page. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** The server render and first hydration pass, where there is no document to read. */
export function serverTheme(): Theme {
  return DEFAULT_THEME;
}

/**
 * Apply a theme now and remember it for the next visit. Applying comes first and never depends
 * on storing: with storage refused the choice still holds for this page, it just is not kept.
 */
export function chooseTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable or refused: the theme is applied, only not remembered.
  }
  for (const listener of listeners) {
    listener();
  }
}
