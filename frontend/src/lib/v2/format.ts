/**
 * The formatting V2 needs and `src/lib/chart/format.ts` does not already provide.
 *
 * V1's formatters are reused unchanged wherever they fit (`formatWeightKg`,
 * `formatWeightRangeKg`, `formatWeeklyRateKg`, `formatShortDate`, `formatFullDate`); this
 * module adds only what the analysis rail asks for that V1 has no need of -- values shown at
 * their published precision rather than rounded to one decimal, an unsigned rate for a
 * standard deviation, and a time of day for a weigh-in.
 *
 * Same rules as V1: presentation only. Nothing here computes, interprets or classifies, and
 * locale stays pinned to `en-GB` so a number renders identically in a test, in CI and on a
 * user's machine.
 */

const MINUS_SIGN = "−";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const monthYearFormatter = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });

/**
 * A number at a chosen precision, e.g. `formatNumber(0.008099238707340582, 4)` -> "0.0081".
 *
 * Used by the statistics and mathematics tiers, where rounding a published model parameter to
 * one decimal would destroy the value being quoted.
 */
export function formatNumber(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** "0.203 kg" -- a weight at a chosen precision, for standard deviations and intervals. */
export function formatKgPrecise(kg: number, fractionDigits: number): string {
  return `${formatNumber(kg, fractionDigits)} kg`;
}

/**
 * "0.18 kg/week", unsigned.
 *
 * For a standard deviation, which is a magnitude: signing it the way
 * `formatWeeklyRateKg` signs a rate would read as a direction that a spread does not have.
 */
export function formatRateMagnitude(kgPerWeek: number): string {
  return `${formatNumber(Math.abs(kgPerWeek), 2)} kg/week`;
}

/** "3.1 kg", unsigned -- a distance, which carries its direction in the words beside it. */
export function formatKgMagnitude(kg: number): string {
  return `${formatNumber(Math.abs(kg), 1)} kg`;
}

/**
 * "+0.2 kg" / "−0.2 kg" with a true minus sign; "0.0 kg" unsigned at zero.
 *
 * For a difference shown in a column of its own, where no words carry the direction. As with
 * a rate, a sign in front of a value that rounds to zero would report a direction the numbers
 * do not support.
 */
export function formatSignedKg(kg: number): string {
  const magnitude = formatNumber(Math.abs(kg), 1);
  if (Number.parseFloat(magnitude) === 0) {
    return `${magnitude} kg`;
  }
  return `${kg < 0 ? MINUS_SIGN : "+"}${magnitude} kg`;
}

/** "+0.08 kg/week" / "-0.08 kg/week" with a true minus sign; "0.00 kg/week" unsigned at zero. */
export function formatSignedRate(kgPerWeek: number): string {
  const magnitude = formatNumber(Math.abs(kgPerWeek), 2);
  if (Number.parseFloat(magnitude) === 0) {
    return `${magnitude} kg/week`;
  }
  return `${kgPerWeek < 0 ? MINUS_SIGN : "+"}${magnitude} kg/week`;
}

/** "08:50" -- the time of a weigh-in, which a date alone does not carry. */
export function formatTimeOfDay(date: Date): string {
  return timeFormatter.format(date);
}

/** "Aug 2026" -- an x-axis tick where a series spans months. */
export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

/** "119 days" / "1 day" / "0.25 days" -- a span, keeping fractions the backend published. */
export function formatDayCount(days: number): string {
  const isWhole = Number.isInteger(days);
  const text = isWhole ? String(days) : formatNumber(days, 2);
  return `${text} ${isWhole && Math.abs(days) === 1 ? "day" : "days"}`;
}
