/**
 * A small, hand-written, compile-checked fixture -- not a captured response.
 *
 * `gradual-loss.json` alongside this file is a real captured `/api/demo/gradual-loss`
 * response (120 observations) and is used only where the client's actual JSON-parsing path
 * needs exercising (see `client.test.ts`): that path legitimately treats an HTTP body as
 * untyped input, the same way the client code itself does.
 *
 * Everywhere else -- `buildChartSeries`, component rendering -- a full 120-point capture is
 * unreadable as a test fixture and asserts nothing about the *shape* of the contract. This
 * fixture is instead a plain TypeScript object literal checked with `satisfies DemoAnalysis`,
 * so if a field is missing, misspelled or the wrong type, `tsc` fails here -- not a `JSON.parse`
 * cast quietly hiding a mismatch (`as DemoAnalysis` would accept this even if a required field
 * were absent; `satisfies` will not).
 *
 * The numbers are drawn from a real captured response so relationships stay realistic: weight
 * gently declining with shrinking trajectory uncertainty, the trajectory ending at
 * `last_observation_timestamp`, and `forecast.path[0]` at `origin_timestamp` 0.25 days later
 * with a slightly different `w_kg` -- the same state, propagated over the lead (ADR-0005).
 * That gap is exactly what `buildChartSeries`'s history/forecast join has to bridge.
 */

import type { DemoAnalysis } from "../types";

export const demoAnalysisFixture = {
  n_obs: 4,
  span_days: 3,
  params: {
    sigma_obs_kg: 0.5,
    sigma_accel: 0.0080992387073405,
    sigma_v0: 0.1428571428571428,
    weekly_rate_drift_kg_per_week: 0.15,
    initial_weekly_rate_spread_kg_per_week: 1,
  },
  observations: [
    { timestamp: "2026-04-23T08:50:16.705Z", weight_kg: 81.683939 },
    { timestamp: "2026-04-24T08:50:16.705Z", weight_kg: 81.1361498 },
    { timestamp: "2026-04-25T08:50:16.705Z", weight_kg: 82.1413207 },
    { timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 82.1477178 },
  ],
  trajectory: [
    {
      timestamp: "2026-04-23T08:50:16.705Z",
      w_kg: 81.683939,
      w_sd: 0.5,
      w_lower95: 80.703957,
      w_upper95: 82.663921,
    },
    {
      timestamp: "2026-04-24T08:50:16.705Z",
      w_kg: 81.512017,
      w_sd: 0.3814,
      w_lower95: 80.764461,
      w_upper95: 82.259573,
    },
    {
      timestamp: "2026-04-25T08:50:16.705Z",
      w_kg: 81.601805,
      w_sd: 0.3204,
      w_lower95: 80.973835,
      w_upper95: 82.229775,
    },
    {
      timestamp: "2026-04-26T08:50:16.705Z",
      w_kg: 81.734891,
      w_sd: 0.2841,
      w_lower95: 81.178055,
      w_upper95: 82.291727,
    },
  ],
  current: {
    timestamp: "2026-04-26T08:50:16.705Z",
    w_kg: 81.734891,
    w_sd: 0.2841,
    w_lower95: 81.178055,
    w_upper95: 82.291727,
    weekly_rate_kg: -0.421428,
    weekly_rate_sd_kg: 0.848163,
  },
  forecast: {
    origin_timestamp: "2026-04-26T14:50:16.705Z",
    last_observation_timestamp: "2026-04-26T08:50:16.705Z",
    lead_days: 0.25,
    includes_observation_noise: false,
    horizons: [
      {
        timestamp: "2026-05-03T14:50:16.705Z",
        horizon_days: 7,
        w_kg: 79.283,
        w_sd: 0.9231,
        w_lower95: 77.4737,
        w_upper95: 81.0923,
      },
      {
        timestamp: "2026-05-26T14:50:16.705Z",
        horizon_days: 30,
        w_kg: 72.156,
        w_sd: 2.4103,
        w_lower95: 67.4318,
        w_upper95: 76.8802,
      },
      {
        timestamp: "2026-07-25T14:50:16.705Z",
        horizon_days: 90,
        w_kg: 54.842,
        w_sd: 6.7351,
        w_lower95: 41.6412,
        w_upper95: 68.0428,
      },
    ],
    path: [
      {
        timestamp: "2026-04-26T14:50:16.705Z",
        horizon_days: 0,
        w_kg: 81.72,
        w_sd: 0.291,
        w_lower95: 81.1497,
        w_upper95: 82.2903,
      },
      {
        timestamp: "2026-05-03T14:50:16.705Z",
        horizon_days: 7,
        w_kg: 79.283,
        w_sd: 0.9231,
        w_lower95: 77.4737,
        w_upper95: 81.0923,
      },
      {
        timestamp: "2026-05-26T14:50:16.705Z",
        horizon_days: 30,
        w_kg: 72.156,
        w_sd: 2.4103,
        w_lower95: 67.4318,
        w_upper95: 76.8802,
      },
      {
        timestamp: "2026-07-25T14:50:16.705Z",
        horizon_days: 90,
        w_kg: 54.842,
        w_sd: 6.7351,
        w_lower95: 41.6412,
        w_upper95: 68.0428,
      },
    ],
  },
  meta: {
    source: "demo",
    filtered_not_smoothed: true,
    interval_describes: "latent_weight",
  },
  scenario: {
    id: "gradual-loss",
    title: "Gradual loss",
    description: "A steady downward trend under ordinary day-to-day measurement noise.",
    label: "synthetic gradual loss (seed 101)",
    seed: 101,
    parameters: {
      seed: 101,
      n_obs: 4,
      start_kg: 82,
      noise_sd_kg: 0.4,
      velocity_schedule: "-0.35 kg/week",
      gap_pattern_days: "1",
      trailing_lag_days: 0.25,
    },
  },
} satisfies DemoAnalysis;
