/**
 * Small lookups over an analysis response that are not chart-specific and not formatting --
 * just reading a value the contract guarantees exists.
 */

import type { Forecast, ForecastPoint } from "@/lib/api/types";

/** The forecast horizon promoted to a page-level headline (master plan section 9). */
export const HEADLINE_FORECAST_HORIZON_DAYS = 30;

/**
 * Return the forecast point at exactly `days`.
 *
 * The backend publishes precisely 7, 30 and 90 (`FORECAST_HORIZONS_DAYS`, fixed and not
 * caller-selectable), so a missing horizon means the contract changed underneath this
 * frontend. Throwing here is deliberate: silently rendering nothing would look like a bug
 * in the estimate rather than a contract mismatch.
 */
export function horizonPoint(forecast: Forecast, days: number): ForecastPoint {
  const point = forecast.horizons.find((horizon) => horizon.horizon_days === days);
  if (!point) {
    throw new Error(`the analysis response has no ${days}-day forecast horizon`);
  }
  return point;
}
