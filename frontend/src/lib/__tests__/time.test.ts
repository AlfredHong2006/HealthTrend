import { describe, expect, it } from "vitest";
import { canonicalizeTimeZone, datetimeLocalToUtcIso, detectLocalTimeZone } from "../time";

/**
 * Expected values are computed with the local-component `Date` constructor
 * (`new Date(year, month, day, ...)`), which the runtime always interprets as local time --
 * the same interpretation `datetimeLocalToUtcIso` relies on for the input string. Comparing
 * against that, rather than a hardcoded UTC string, keeps these tests correct regardless of
 * which timezone the machine or CI runner is in.
 */
describe("datetimeLocalToUtcIso", () => {
  it("interprets a full local date-time value and returns its UTC instant", () => {
    const expected = new Date(2026, 7, 21, 14, 30, 0).toISOString(); // month is 0-indexed
    expect(datetimeLocalToUtcIso("2026-08-21T14:30")).toBe(expected);
  });

  it("accepts seconds when the input element supplies them", () => {
    const expected = new Date(2026, 7, 21, 14, 30, 45).toISOString();
    expect(datetimeLocalToUtcIso("2026-08-21T14:30:45")).toBe(expected);
  });

  it("rejects an empty value", () => {
    expect(datetimeLocalToUtcIso("")).toBeNull();
  });

  it("rejects a date-only value -- that shape parses as UTC midnight instead of local time", () => {
    expect(datetimeLocalToUtcIso("2026-08-21")).toBeNull();
  });

  it("rejects a value missing minutes", () => {
    expect(datetimeLocalToUtcIso("2026-08-21T14")).toBeNull();
  });

  it("rejects a value that already carries a timezone offset", () => {
    expect(datetimeLocalToUtcIso("2026-08-21T14:30+01:00")).toBeNull();
  });

  it("rejects trailing garbage after an otherwise valid value", () => {
    expect(datetimeLocalToUtcIso("2026-08-21T14:30 ")).toBeNull();
  });
});

describe("detectLocalTimeZone", () => {
  it("returns a non-empty, already-canonical IANA zone", () => {
    const zone = detectLocalTimeZone();
    expect(typeof zone).toBe("string");
    expect(zone.length).toBeGreaterThan(0);
    expect(canonicalizeTimeZone(zone)).toBe(zone);
  });
});

describe("canonicalizeTimeZone", () => {
  it("returns well-known IANA zones unchanged", () => {
    expect(canonicalizeTimeZone("Europe/London")).toBe("Europe/London");
    expect(canonicalizeTimeZone("America/New_York")).toBe("America/New_York");
    expect(canonicalizeTimeZone("UTC")).toBe("UTC");
  });

  it("canonicalises a differently-cased zone name to the IANA form the backend expects", () => {
    expect(canonicalizeTimeZone("america/new_york")).toBe("America/New_York");
    expect(canonicalizeTimeZone("EUROPE/LONDON")).toBe("Europe/London");
  });

  it("rejects an empty value", () => {
    expect(canonicalizeTimeZone("")).toBeNull();
    expect(canonicalizeTimeZone("   ")).toBeNull();
  });

  it("rejects a name Intl does not recognise", () => {
    expect(canonicalizeTimeZone("Not/A_Real_Zone")).toBeNull();
  });
});
