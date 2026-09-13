import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { getAccountAnalysis } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { AnalysisResponse, MeOut } from "@/lib/api/types";
import type { PersistedGoal } from "@/components/v2/V2Workspace/V2Workspace";
import { AppDashboard } from "../AppDashboard";

vi.mock("@/lib/api/accountClient", () => ({
  getAccountAnalysis: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

interface CapturedProps {
  analysis: AnalysisResponse;
  unit: string;
  persistedGoal?: PersistedGoal;
}

const capturedProps: CapturedProps[] = [];

vi.mock("@/components/v2/V2Workspace/V2Workspace", () => ({
  V2Workspace: (props: CapturedProps) => {
    capturedProps.push(props);
    return <div data-testid="v2-workspace">{props.analysis.n_obs} observations</div>;
  },
}));

interface AccountShape {
  goal?: MeOut["goal"];
  displayUnit?: "kg" | "lb";
}

function accountWith(measurementCount: number, shape: AccountShape = {}): MeOut {
  return {
    user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
    preferences: { display_unit: shape.displayUnit ?? "kg" },
    goal: shape.goal ?? null,
    measurement_count: measurementCount,
  };
}

function mockAccount(measurementCount: number, dataVersion = 0, shape: AccountShape = {}) {
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: accountWith(measurementCount, shape),
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
  capturedProps.length = 0;
});

describe("AppDashboard", () => {
  it("renders an honest empty state at zero measurements and requests no analysis", async () => {
    mockAccount(0);

    render(<AppDashboard />);

    expect(screen.getByText("No measurements are stored yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("v2-workspace")).not.toBeInTheDocument();
    // No plateau, on-plan, or departure language -- M7A output has no path into this screen.
    expect(screen.queryByText(/plateau|on.plan|departure|change.point/i)).not.toBeInTheDocument();
    await Promise.resolve();
    expect(getAccountAnalysis).not.toHaveBeenCalled();
  });

  it("fetches and renders the genuine account analysis when measurements exist", async () => {
    vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
    mockAccount(4);

    render(<AppDashboard />);

    await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
    expect(getAccountAnalysis).toHaveBeenCalledTimes(1);
    expect(capturedProps[0]?.analysis).toEqual(demoAnalysisFixture);
  });

  it("shows a recoverable error when the account analysis request fails", async () => {
    vi.mocked(getAccountAnalysis).mockRejectedValue(
      new ApiError(500, { code: "internal_error", message: "Something went wrong on our side." }),
    );
    mockAccount(4);

    render(<AppDashboard />);

    await waitFor(() =>
      expect(screen.getByText("Something went wrong on our side.")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("v2-workspace")).not.toBeInTheDocument();
  });

  it("degrades to a generic message on a network failure", async () => {
    vi.mocked(getAccountAnalysis).mockRejectedValue(new NetworkError(new TypeError("offline")));
    mockAccount(4);

    render(<AppDashboard />);

    await waitFor(() =>
      expect(screen.getByText("Could not reach the analysis service.")).toBeInTheDocument(),
    );
  });

  describe("Stage 5 invalidation", () => {
    it("re-fetches analysis when dataVersion changes, even with the same measurement count (edit)", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValueOnce(demoAnalysisFixture);
      mockAccount(4, 0);
      const { rerender } = render(<AppDashboard />);
      await waitFor(() => expect(getAccountAnalysis).toHaveBeenCalledTimes(1));

      const editedAnalysis = { ...demoAnalysisFixture, n_obs: 5 };
      vi.mocked(getAccountAnalysis).mockResolvedValueOnce(editedAnalysis);
      mockAccount(4, 1); // same count as an edit would leave it -- only dataVersion moved
      rerender(<AppDashboard />);

      await waitFor(() => expect(getAccountAnalysis).toHaveBeenCalledTimes(2));
      expect(capturedProps.at(-1)?.analysis).toEqual(editedAnalysis);
    });

    it("moves from an analysis to the honest empty state when the last measurement is deleted", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValueOnce(demoAnalysisFixture);
      mockAccount(1, 0);
      const { rerender } = render(<AppDashboard />);
      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());

      mockAccount(0, 1); // the delete's notifyMeasurementsChanged() drops the count to zero
      rerender(<AppDashboard />);

      expect(screen.getByText("No measurements are stored yet.")).toBeInTheDocument();
      expect(screen.queryByTestId("v2-workspace")).not.toBeInTheDocument();
    });

    it("picks up the first measurement after starting from zero (Case A)", async () => {
      mockAccount(0, 0);
      const { rerender } = render(<AppDashboard />);
      expect(screen.getByText("No measurements are stored yet.")).toBeInTheDocument();
      expect(getAccountAnalysis).not.toHaveBeenCalled();

      vi.mocked(getAccountAnalysis).mockResolvedValueOnce(demoAnalysisFixture);
      mockAccount(1, 1);
      rerender(<AppDashboard />);

      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
      expect(screen.queryByText("No measurements are stored yet.")).not.toBeInTheDocument();
    });
  });

  describe("Stage 6 stored goal and display unit", () => {
    it("hands the stored goal to V2Workspace, in kilograms, with a link to Settings", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4, 0, { goal: { target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 } });

      render(<AppDashboard />);

      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
      expect(capturedProps.at(-1)?.persistedGoal).toEqual({
        targetKg: 78.5,
        targetRateKg: -0.5,
        manageHref: "/app/settings",
      });
    });

    it("passes an empty stored goal when the account has none", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4);

      render(<AppDashboard />);

      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
      expect(capturedProps.at(-1)?.persistedGoal).toMatchObject({
        targetKg: null,
        targetRateKg: null,
      });
    });

    it("reflects a removed goal without refetching the analysis", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4, 0, { goal: { target_weight_kg: 78.5, target_weekly_rate_kg: null } });
      const { rerender } = render(<AppDashboard />);
      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());

      // reloadAccount() after DELETE /api/me/goal: same count, same dataVersion, goal gone.
      mockAccount(4, 0, { goal: null });
      rerender(<AppDashboard />);

      expect(capturedProps.at(-1)?.persistedGoal?.targetKg).toBeNull();
      expect(getAccountAnalysis).toHaveBeenCalledTimes(1);
    });

    it("never sends the goal with the analysis request", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4, 0, { goal: { target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 } });

      render(<AppDashboard />);

      await waitFor(() => expect(getAccountAnalysis).toHaveBeenCalledTimes(1));
      expect(vi.mocked(getAccountAnalysis).mock.calls[0]).toEqual([]);
    });

    it("shows Trend in the stored display unit, and a unit change does not refetch analysis", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4, 0, { displayUnit: "lb" });
      const { rerender } = render(<AppDashboard />);
      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
      expect(capturedProps.at(-1)?.unit).toBe("lb");

      mockAccount(4, 0, { displayUnit: "kg" });
      rerender(<AppDashboard />);

      expect(capturedProps.at(-1)?.unit).toBe("kg");
      expect(getAccountAnalysis).toHaveBeenCalledTimes(1);
    });

    it("introduces no on-plan, ETA or progress wording alongside a stored goal", async () => {
      vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);
      mockAccount(4, 0, { goal: { target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 } });

      render(<AppDashboard />);

      await waitFor(() => expect(screen.getByTestId("v2-workspace")).toBeInTheDocument());
      expect(screen.queryByText(/on.plan|on track|ETA|plateau|departure|ahead|behind/i)).toBeNull();
    });
  });
});
