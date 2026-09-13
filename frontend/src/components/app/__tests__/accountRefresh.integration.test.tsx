import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountImport } from "@/components/app/AccountImport/AccountImport";
import { AccountProvider, useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { AppDashboard } from "@/components/app/AppDashboard/AppDashboard";
import { QuickLog } from "@/components/app/QuickLog/QuickLog";
import { DisplayUnitSetting } from "@/components/app/Settings/DisplayUnitSetting";
import { GoalSetting } from "@/components/app/Settings/GoalSetting";
import type { PersistedGoal } from "@/components/v2/V2Workspace/V2Workspace";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import {
  deleteGoal,
  getAccountAnalysis,
  getCurrentAccount,
  importMeasurementsBatch,
  updateGoal,
  updatePreferences,
} from "@/lib/api/accountClient";
import type { AnalysisResponse, CsvIngestResponse, MeOut } from "@/lib/api/types";

/**
 * Stage 6's state-consistency cases, end to end through the real `AccountProvider`: only the
 * network calls are mocked. Swapping the provider's children with `rerender` keeps the provider
 * mounted while one screen unmounts and the next mounts -- the same thing an in-app navigation
 * between `/app/*` routes does under the shared `/app` layout.
 */

vi.mock("@/lib/api/accountClient", () => ({
  getCurrentAccount: vi.fn(),
  logout: vi.fn(),
  deleteAccount: vi.fn(),
  getAccountAnalysis: vi.fn(),
  updatePreferences: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  importMeasurementsBatch: vi.fn(),
  createMeasurement: vi.fn(),
}));

const { ingestCsv } = vi.hoisted(() => ({ ingestCsv: vi.fn() }));
vi.mock("@/lib/api/browserClient", () => ({ ingestCsv }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const workspaceProps: { analysis: AnalysisResponse; unit: string; persistedGoal?: PersistedGoal }[] =
  [];

vi.mock("@/components/v2/V2Workspace/V2Workspace", () => ({
  V2Workspace: (props: { analysis: AnalysisResponse; unit: string; persistedGoal?: PersistedGoal }) => {
    workspaceProps.push(props);
    return <div data-testid="v2-workspace" />;
  },
}));

function me(overrides: Partial<MeOut> = {}): MeOut {
  return {
    user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
    preferences: { display_unit: "kg" },
    goal: null,
    measurement_count: 4,
    ...overrides,
  };
}

function Ready({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  return status === "authenticated" ? <>{children}</> : <p>checking</p>;
}

function inProvider(screenNode: ReactNode) {
  return (
    <AccountProvider>
      <Ready>{screenNode}</Ready>
    </AccountProvider>
  );
}

const PARSED: CsvIngestResponse = {
  accepted: [{ timestamp: "2026-05-01T07:00:00Z", weight: 72.4, unit: "kg" }],
  rejected: [],
  issues_truncated: false,
  accepted_count: 1,
  rejected_count: 0,
  duplicate_count: 0,
  blank_rows_skipped: 0,
  naive_timestamp_count: 0,
  date_only_count: 0,
};

async function importOneFile() {
  const input = (await screen.findByLabelText("CSV file")) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["timestamp,weight\n"], "h.csv", { type: "text/csv" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Read file" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add 1 measurement to history" }));
  await screen.findByRole("link", { name: "View trend" });
}

afterEach(() => {
  vi.resetAllMocks();
  workspaceProps.length = 0;
});

describe("Stage 6 account refresh", () => {
  it("A: kg -> lb in Settings, then Log defaults to lb", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount)
      .mockResolvedValueOnce(me())
      .mockResolvedValueOnce(me({ preferences: { display_unit: "lb" } }));
    vi.mocked(updatePreferences).mockResolvedValue({ display_unit: "lb" });

    const { rerender } = render(inProvider(<DisplayUnitSetting />));
    await user.click(await screen.findByRole("radio", { name: "lb" }));
    await waitFor(() => expect(getCurrentAccount).toHaveBeenCalledTimes(2));

    rerender(inProvider(<QuickLog />));

    expect(await screen.findByRole("radio", { name: "lb" })).toBeChecked();
  });

  it("B: set a goal in Settings, then Trend shows it -- without refetching analysis", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount)
      .mockResolvedValueOnce(me())
      .mockResolvedValueOnce(me({ goal: { target_weight_kg: 78.5, target_weekly_rate_kg: null } }));
    vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 78.5, target_weekly_rate_kg: null });
    vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);

    const { rerender } = render(inProvider(<GoalSetting unit="kg" />));
    await user.type(await screen.findByLabelText(/Target weight/), "78.5");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    await screen.findByText("Goal saved.");

    rerender(inProvider(<AppDashboard />));

    await screen.findByTestId("v2-workspace");
    expect(workspaceProps.at(-1)?.persistedGoal?.targetKg).toBe(78.5);
    // The goal never reaches the analysis request.
    expect(vi.mocked(getAccountAnalysis).mock.calls).toEqual([[]]);
  });

  it("C: delete the goal in Settings, then Trend no longer shows it", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount)
      .mockResolvedValueOnce(me({ goal: { target_weight_kg: 78.5, target_weekly_rate_kg: null } }))
      .mockResolvedValueOnce(me({ goal: null }));
    vi.mocked(deleteGoal).mockResolvedValue(undefined);
    vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);

    const { rerender } = render(inProvider(<GoalSetting unit="kg" />));
    await user.click(await screen.findByRole("button", { name: "Remove goal" }));
    await screen.findByText("Goal removed.");

    rerender(inProvider(<AppDashboard />));

    await screen.findByTestId("v2-workspace");
    expect(workspaceProps.at(-1)?.persistedGoal).toMatchObject({ targetKg: null, targetRateKg: null });
  });

  it("D: import the first measurements into an empty account, then Trend renders analysis", async () => {
    vi.mocked(getCurrentAccount)
      .mockResolvedValueOnce(me({ measurement_count: 0 }))
      .mockResolvedValueOnce(me({ measurement_count: 1 }));
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 1,
      skipped_existing_count: 0,
    });
    vi.mocked(getAccountAnalysis).mockResolvedValue(demoAnalysisFixture);

    const { rerender } = render(inProvider(<AccountImport />));
    await importOneFile();

    rerender(inProvider(<AppDashboard />));

    await screen.findByTestId("v2-workspace");
    expect(screen.queryByText("No measurements are stored yet.")).not.toBeInTheDocument();
    expect(getAccountAnalysis).toHaveBeenCalledTimes(1);
  });

  it("E: import into a populated account invalidates and refetches the Trend analysis", async () => {
    vi.mocked(getCurrentAccount)
      .mockResolvedValueOnce(me({ measurement_count: 4 }))
      .mockResolvedValueOnce(me({ measurement_count: 5 }));
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 1,
      skipped_existing_count: 0,
    });
    const refreshed = { ...demoAnalysisFixture, n_obs: 5 };
    vi.mocked(getAccountAnalysis)
      .mockResolvedValueOnce(demoAnalysisFixture)
      .mockResolvedValueOnce(refreshed);

    // Both screens mounted together, so the analysis refetch can only come from invalidation --
    // not from Trend simply mounting afresh.
    render(
      inProvider(
        <>
          <AppDashboard />
          <AccountImport />
        </>,
      ),
    );
    await waitFor(() => expect(getAccountAnalysis).toHaveBeenCalledTimes(1));

    await importOneFile();

    await waitFor(() => expect(getAccountAnalysis).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(workspaceProps.at(-1)?.analysis.n_obs).toBe(5));
  });
});
