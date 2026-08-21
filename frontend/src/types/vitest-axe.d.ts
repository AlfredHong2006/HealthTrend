// vitest-axe declares its matcher but, unlike @testing-library/jest-dom, ships no global
// Vitest type augmentation for it. Registered by hand here, the same way
// @testing-library/jest-dom/types/vitest.d.ts does it for its own matchers.
import "vitest";
import type { AxeMatchers } from "vitest-axe/dist/matchers";

declare module "vitest" {
  // The empty body is the point: this is declaration merging into vitest's own
  // `Assertion` interface, not a redundant standalone alias.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
}
