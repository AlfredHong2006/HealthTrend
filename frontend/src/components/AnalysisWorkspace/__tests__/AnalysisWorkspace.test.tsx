import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { AnalysisResponse } from "@/lib/api/types";
import { AnalysisWorkspace } from "../AnalysisWorkspace";

const { submitAnalysis } = vi.hoisted(() => ({ submitAnalysis: vi.fn() }));
vi.mock("@/lib/api/browserClient", () => ({ submitAnalysis }));

const ESTABLISHED_RESULT: AnalysisResponse = {
  n_obs: 4,
  span_days: 3,
  params: {
    sigma_obs_kg: 0.5,
    sigma_accel: 0.008,
    sigma_v0: 0.1428571428571428,
    weekly_rate_drift_kg_per_week: 0.15,
    initial_weekly_rate_spread_kg_per_week: 1,
  },
  observations: [
    { timestamp: "2026-04-23T08:50:16.705Z", weight_kg: 81.68 },
    { timestamp: "2026-04-24T08:50:16.705Z", weight_kg: 81.14 },
    { timestamp: "2026-04-25T08:50:16.705Z", weight_kg: 82.14 },
    { timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 82.15 },
  ],
  trajectory: [
    { timestamp: "2026-04-23T08:50:16.705Z", w_kg: 81.68, w_sd: 0.5, w_lower95: 80.7, w_upper95: 82.66 },
    { timestamp: "2026-04-26T08:50:16.705Z", w_kg: 81.73, w_sd: 0.28, w_lower95: 81.18, w_upper95: 82.29 },
  ],
  current: {
    timestamp: "2026-04-26T08:50:16.705Z",
    w_kg: 81.73,
    w_sd: 0.28,
    w_lower95: 81.18,
    w_upper95: 82.29,
    weekly_rate_kg: -0.42,
    weekly_rate_sd_kg: 0.85,
  },
  forecast: {
    origin_timestamp: "2026-04-26T14:50:16.705Z",
    last_observation_timestamp: "2026-04-26T08:50:16.705Z",
    lead_days: 0.25,
    includes_observation_noise: false,
    horizons: [
      { timestamp: "2026-05-03T14:50:16.705Z", horizon_days: 7, w_kg: 79.28, w_sd: 0.92, w_lower95: 77.47, w_upper95: 81.09 },
      { timestamp: "2026-05-26T14:50:16.705Z", horizon_days: 30, w_kg: 72.16, w_sd: 2.41, w_lower95: 67.43, w_upper95: 76.88 },
      { timestamp: "2026-07-25T14:50:16.705Z", horizon_days: 90, w_kg: 54.84, w_sd: 6.74, w_lower95: 41.64, w_upper95: 68.04 },
    ],
    path: [
      { timestamp: "2026-04-26T14:50:16.705Z", horizon_days: 0, w_kg: 81.72, w_sd: 0.29, w_lower95: 81.15, w_upper95: 82.29 },
      { timestamp: "2026-05-03T14:50:16.705Z", horizon_days: 7, w_kg: 79.28, w_sd: 0.92, w_lower95: 77.47, w_upper95: 81.09 },
      { timestamp: "2026-05-26T14:50:16.705Z", horizon_days: 30, w_kg: 72.16, w_sd: 2.41, w_lower95: 67.43, w_upper95: 76.88 },
      { timestamp: "2026-07-25T14:50:16.705Z", horizon_days: 90, w_kg: 54.84, w_sd: 6.74, w_lower95: 41.64, w_upper95: 68.04 },
    ],
  },
  meta: { source: "submitted", filtered_not_smoothed: true, interval_describes: "latent_weight" },
};

/** One reading: ADR-0003's exact posterior, `weekly_rate_kg` and `span_days` both zero. */
const ONE_OBSERVATION_RESULT: AnalysisResponse = {
  ...ESTABLISHED_RESULT,
  n_obs: 1,
  span_days: 0,
  observations: [{ timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 72.4 }],
  trajectory: [{ timestamp: "2026-04-26T08:50:16.705Z", w_kg: 72.4, w_sd: 0.5, w_lower95: 71.42, w_upper95: 73.38 }],
  current: { ...ESTABLISHED_RESULT.current, timestamp: "2026-04-26T08:50:16.705Z", w_kg: 72.4, weekly_rate_kg: 0 },
};

/** Two readings at the same instant: same degenerate case as one reading (span_days === 0). */
const SAME_INSTANT_RESULT: AnalysisResponse = {
  ...ONE_OBSERVATION_RESULT,
  n_obs: 2,
  observations: [
    { timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 72.4 },
    { timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 72.6 },
  ],
};

function fillOneRowAndSubmit() {
  fireEvent.change(screen.getByLabelText("Date and time"), {
    target: { value: "2026-08-21T07:30" },
  });
  fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "72.4" } });
  fireEvent.click(screen.getByRole("button", { name: "Analyse" }));
}

describe("AnalysisWorkspace", () => {
  it("renders the estimate, rate and forecast for an established trend", async () => {
    submitAnalysis.mockResolvedValueOnce(ESTABLISHED_RESULT);
    render(<AnalysisWorkspace />);

    fillOneRowAndSubmit();

    expect(await screen.findByText("81.7 kg", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("−0.42 kg/week", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/30-day forecast/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Weight trend chart/ })).toBeInTheDocument();
  });

  it("shows only the estimate and 'Trend not established yet' for a single observation", async () => {
    submitAnalysis.mockResolvedValueOnce(ONE_OBSERVATION_RESULT);
    render(<AnalysisWorkspace />);

    fillOneRowAndSubmit();

    expect(await screen.findByText("Trend not established yet.")).toBeInTheDocument();
    expect(screen.getByText("72.4 kg", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/kg\/week/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30-day forecast/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Weight trend chart/ })).not.toBeInTheDocument();
  });

  it("applies the same zero-span suppression to two observations sharing one instant", async () => {
    submitAnalysis.mockResolvedValueOnce(SAME_INSTANT_RESULT);
    render(<AnalysisWorkspace />);

    fillOneRowAndSubmit();

    expect(await screen.findByText("Trend not established yet.")).toBeInTheDocument();
    expect(screen.queryByText(/kg\/week/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30-day forecast/)).not.toBeInTheDocument();
  });

  it("shows a submission error inline without losing the entered row", async () => {
    submitAnalysis.mockRejectedValueOnce(new ApiError(422, { code: "observation_in_the_future", message: "The most recent observation is dated after the current time.", details: [] }));
    render(<AnalysisWorkspace />);

    fillOneRowAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/dated after the current time/);
    expect(screen.getByLabelText("Date and time")).toHaveValue("2026-08-21T07:30");
    expect(screen.getByLabelText(/Weight/)).toHaveValue(72.4);
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveSubmit!: (value: AnalysisResponse) => void;
    submitAnalysis.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    render(<AnalysisWorkspace />);

    fillOneRowAndSubmit();

    expect(screen.getByRole("button", { name: "Analysing…" })).toBeDisabled();
    resolveSubmit(ESTABLISHED_RESULT);
    await waitFor(() => expect(screen.getByRole("button", { name: "Analyse" })).toBeEnabled());
  });
});
