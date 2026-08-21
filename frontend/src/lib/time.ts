/**
 * Converting a `datetime-local` input's value into a UTC instant the backend can accept.
 *
 * A `datetime-local` string carries no timezone: the browser means "this wall-clock time, on
 * this device". `new Date(...)` parses a full date-and-time string (one containing a literal
 * "T") as local time -- standard `Date` parsing behaviour, not a library -- so once the input
 * is known to have the complete shape the element actually produces, converting it to UTC is
 * two native calls.
 *
 * DST ambiguity is not resolved here: a wall-clock time that occurs twice (a "fall back") or
 * not at all (a "spring forward") on a transition day parses to *some* definite instant
 * without throwing, off by at most one hour, on two days a year, in a series measured in
 * days. That is an accepted V1 limitation, the same kind ADR-0006 already accepted for clock
 * skew -- not something a heuristic correction here could actually fix without knowing which
 * of two valid readings the user meant.
 */

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Parse a `datetime-local` value as local wall-clock time and return it as a UTC ISO-8601
 * instant. Returns `null` for anything that is not the complete `YYYY-MM-DDTHH:mm[:ss]` shape
 * the input element produces -- an empty value, a date-only value, or anything malformed --
 * rather than letting `Date` guess at a different meaning for a shorter string.
 */
export function datetimeLocalToUtcIso(value: string): string | null {
  if (!DATETIME_LOCAL_PATTERN.test(value)) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}
