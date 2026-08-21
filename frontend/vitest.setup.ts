import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
// vitest-axe's own "vitest-axe/extend-expect" entry point ships empty in the installed
// version (zero bytes), and its root "vitest-axe/matchers" re-export has a packaging bug:
// matchers.d.ts does `export type *` while matchers.js does a real `export *`, so
// TypeScript sees the runtime function as type-only and rejects importing it as a value.
// Importing from the package's internal dist path sidesteps both and is exactly what the
// root files resolve to at runtime anyway.
import { toHaveNoViolations } from "vitest-axe/dist/matchers";

expect.extend({ toHaveNoViolations });

// React Testing Library normally registers its own `afterEach(cleanup)` automatically, but
// only when it detects test globals on `globalThis`. This project keeps `globals: false` in
// vitest.config.ts (tests import `describe`/`it`/`expect` explicitly rather than relying on
// injected globals), so that auto-detection never fires and unmounted trees would otherwise
// accumulate in `document.body` across tests in the same file. Registered explicitly instead.
afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver. @visx/responsive's ParentSize still constructs one (to watch
// for future size changes) even when `initialSize` is given, so without this polyfill every
// test that renders TrendChart throws before anything can be asserted. A no-op is correct
// here: tests read the `initialSize` value TrendChart passes in, not a live-resized one.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
