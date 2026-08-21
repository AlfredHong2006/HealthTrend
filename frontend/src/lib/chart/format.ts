/**
 * Presentation formatting only. Every value passed in here is already a number the backend
 * published; nothing in this module computes, rounds for interpretation, or classifies a
 * trend -- it only chooses how many digits and which words to show (master plan section 9:
 * never manufacture false precision).
 *
 * Locale is pinned to `en-GB` rather than left to the runtime default, so a date renders the
 * same way in a test, in CI and on a user's machine regardless of their system locale.
 */

const MINUS_SIGN = "−";
const EN_DASH = "–";

const weightFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const rateFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "75.9 kg" -- one decimal place, matching the master plan's own examples. */
export function formatWeightKg(kg: number): string {
  return `${weightFormatter.format(kg)} kg`;
}

/** "71.7–76.5 kg" -- a 95% interval, one shared unit. */
export function formatWeightRangeKg(lowerKg: number, upperKg: number): string {
  return `${weightFormatter.format(lowerKg)}${EN_DASH}${weightFormatter.format(upperKg)} kg`;
}

/**
 * "−0.42 kg/week" or "+0.26 kg/week" -- always signed, using a true minus sign rather
 * than a hyphen. A rate that rounds to exactly zero at two decimal places gets no sign at
 * all: a hyphen in front of "0.00" would read as a direction that was not actually measured.
 */
export function formatWeeklyRateKg(kgPerWeek: number): string {
  const rounded = rateFormatter.format(Math.abs(kgPerWeek));
  if (Number.parseFloat(rounded) === 0) {
    return `${rounded} kg/week`;
  }
  const sign = kgPerWeek < 0 ? MINUS_SIGN : "+";
  return `${sign}${rounded} kg/week`;
}

/** "23 Apr" -- for chart axis ticks, where the year is implied by context. */
export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date);
}

/** "23 April 2026" -- for tooltips and the chart's accessible label. */
export function formatFullDate(date: Date): string {
  return fullDateFormatter.format(date);
}
