/**
 * Display-unit conversion: kilograms, as the API and every other V2 module deal in, or pounds,
 * as a reader may prefer to read. This is transparent presentation arithmetic -- an exact,
 * well-known conversion applied for display -- not a new capability (docs/design/V2_DESIGN.md,
 * "unit formatting and conversion" is named explicitly as allowed).
 *
 * The choice lives in `V2Workspace` component state, the same way the ephemeral goal does: nothing
 * is persisted, and every value the rest of the workspace reads is still in kilograms. Only the
 * formatting layer converts, at the last possible step.
 */

import { formatNumber } from "@/lib/v2/format";

export type DisplayUnit = "kg" | "lb";

/** International avoirdupois pound, exact (docs/design/09_1B_Implementation_Spec). */
export const KG_PER_LB = 0.45359237;

export const DEFAULT_DISPLAY_UNIT: DisplayUnit = "kg";

const MINUS_SIGN = "−";
const EN_DASH = "–";

/** Convert a weight in kilograms to the chosen display unit. Kilograms in, kilograms out for "kg". */
export function convertKg(kg: number, unit: DisplayUnit): number {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}

/** The inverse of {@link convertKg}: a value typed in the display unit, converted to kilograms. */
export function convertToKg(value: number, unit: DisplayUnit): number {
  return unit === "lb" ? value * KG_PER_LB : value;
}

/** "75.9 kg" / "167.4 lb" -- one decimal, the precision the product shows everywhere. */
export function formatWeightUnit(kg: number, unit: DisplayUnit): string {
  return `${formatNumber(convertKg(kg, unit), 1)} ${unit}`;
}

/** "71.7-76.5 kg" -- a range converted to the display unit, one shared unit suffix. */
export function formatWeightRangeUnit(lowerKg: number, upperKg: number, unit: DisplayUnit): string {
  return (
    `${formatNumber(convertKg(lowerKg, unit), 1)}${EN_DASH}` +
    `${formatNumber(convertKg(upperKg, unit), 1)} ${unit}`
  );
}

/**
 * "-0.42 kg/week" / "+0.26 kg/week" -- always signed, a true minus sign. A rate that rounds to
 * exactly zero at two decimal places gets no sign: a hyphen in front of "0.00" would claim a
 * direction that was not actually measured.
 */
export function formatWeeklyRateUnit(kgPerWeek: number, unit: DisplayUnit): string {
  const magnitude = formatNumber(Math.abs(convertKg(kgPerWeek, unit)), 2);
  if (Number.parseFloat(magnitude) === 0) {
    return `${magnitude} ${unit}/week`;
  }
  return `${kgPerWeek < 0 ? MINUS_SIGN : "+"}${magnitude} ${unit}/week`;
}

/** "0.18 kg/week", unsigned -- for a standard deviation, which is a magnitude, not a direction. */
export function formatRateMagnitudeUnit(kgPerWeek: number, unit: DisplayUnit): string {
  return `${formatNumber(Math.abs(convertKg(kgPerWeek, unit)), 2)} ${unit}/week`;
}

/** "+0.4 kg" / "-0.4 kg", signed at one decimal; "0.0 kg" unsigned at zero. */
export function formatSignedWeightUnit(kg: number, unit: DisplayUnit): string {
  const magnitude = formatNumber(Math.abs(convertKg(kg, unit)), 1);
  if (Number.parseFloat(magnitude) === 0) {
    return `${magnitude} ${unit}`;
  }
  return `${kg < 0 ? MINUS_SIGN : "+"}${magnitude} ${unit}`;
}

/** "3.2 kg", unsigned -- a distance, which carries its direction in the words beside it. */
export function formatWeightMagnitudeUnit(kg: number, unit: DisplayUnit): string {
  return `${formatNumber(Math.abs(convertKg(kg, unit)), 1)} ${unit}`;
}

/** "±0.28 kg" -- a half-width, printed one digit finer than the estimate it qualifies. */
export function formatHalfWidthUnit(sdKg: number, unit: DisplayUnit): string {
  return `±${formatNumber(Math.abs(convertKg(sdKg, unit)), 2)} ${unit}`;
}

/** "0.28 kg", unsigned, at two decimal places -- for a magnitude with no direction of its own. */
export function formatMagnitudeUnit(kg: number, unit: DisplayUnit): string {
  return `${formatNumber(Math.abs(convertKg(kg, unit)), 2)} ${unit}`;
}

/**
 * "−2.08 to +1.24 kg/week" -- a rate range, one shared unit suffix.
 *
 * Joined with the word "to" rather than an en dash: a rate interval routinely spans two negative
 * numbers (or straddles zero), and "−2.08–−1.24" reads as a run of dashes with the sign lost in
 * it. Each bound keeps its own explicit sign for the same reason {@link formatWeeklyRateUnit}
 * does -- a bound that rounds to exactly zero prints unsigned.
 */
export function formatRateRangeUnit(
  lowerKgPerWeek: number,
  upperKgPerWeek: number,
  unit: DisplayUnit,
): string {
  return (
    `${signedRateBound(lowerKgPerWeek, unit)} to ${signedRateBound(upperKgPerWeek, unit)} ${unit}/week`
  );
}

function signedRateBound(kgPerWeek: number, unit: DisplayUnit): string {
  const magnitude = formatNumber(Math.abs(convertKg(kgPerWeek, unit)), 2);
  if (Number.parseFloat(magnitude) === 0) {
    return magnitude;
  }
  return `${kgPerWeek < 0 ? MINUS_SIGN : "+"}${magnitude}`;
}
