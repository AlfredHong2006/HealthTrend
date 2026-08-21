import { describe, expect, it } from "vitest";
import { datetimeLocalToUtcIso } from "../time";

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
