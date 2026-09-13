import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import * as accountClient from "@/lib/api/accountClient";
import { NetworkError } from "@/lib/api/errors";
import type { MeOut } from "@/lib/api/types";
import { DisplayUnitSetting } from "../DisplayUnitSetting";

vi.mock("@/lib/api/accountClient", () => ({
  updatePreferences: vi.fn(),
  updateMeasurement: vi.fn(),
  importMeasurementsBatch: vi.fn(),
  getMeasurements: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

function meWith(displayUnit: "kg" | "lb"): MeOut {
  return {
    user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
    preferences: { display_unit: displayUnit },
    goal: null,
    measurement_count: 3,
  };
}

function mockAccount(displayUnit: "kg" | "lb") {
  const reloadAccount = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: meWith(displayUnit),
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount,
    deleteAccount: vi.fn(),
  });
  return reloadAccount;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("DisplayUnitSetting", () => {
  it("shows the stored preference as selected", () => {
    mockAccount("lb");
    render(<DisplayUnitSetting />);

    expect(screen.getByRole("radio", { name: "lb" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "kg" })).not.toBeChecked();
  });

  it("saves kg -> lb and re-reads the account", async () => {
    const user = userEvent.setup();
    const reload = mockAccount("kg");
    vi.mocked(accountClient.updatePreferences).mockResolvedValue({ display_unit: "lb" });
    render(<DisplayUnitSetting />);

    await user.click(screen.getByRole("radio", { name: "lb" }));

    await waitFor(() =>
      expect(accountClient.updatePreferences).toHaveBeenCalledWith({ display_unit: "lb" }),
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("saves lb -> kg", async () => {
    const user = userEvent.setup();
    mockAccount("lb");
    vi.mocked(accountClient.updatePreferences).mockResolvedValue({ display_unit: "kg" });
    render(<DisplayUnitSetting />);

    await user.click(screen.getByRole("radio", { name: "kg" }));

    await waitFor(() =>
      expect(accountClient.updatePreferences).toHaveBeenCalledWith({ display_unit: "kg" }),
    );
  });

  it("touches no stored measurement when the unit changes", async () => {
    const user = userEvent.setup();
    mockAccount("kg");
    vi.mocked(accountClient.updatePreferences).mockResolvedValue({ display_unit: "lb" });
    render(<DisplayUnitSetting />);

    await user.click(screen.getByRole("radio", { name: "lb" }));

    await waitFor(() => expect(accountClient.updatePreferences).toHaveBeenCalledTimes(1));
    expect(accountClient.updateMeasurement).not.toHaveBeenCalled();
    expect(accountClient.importMeasurementsBatch).not.toHaveBeenCalled();
    expect(accountClient.getMeasurements).not.toHaveBeenCalled();
    expect(screen.getByText(/keep the unit they were entered in/)).toBeInTheDocument();
  });

  it("does not call the API when the already-stored unit is chosen again", async () => {
    const user = userEvent.setup();
    mockAccount("kg");
    render(<DisplayUnitSetting />);

    await user.click(screen.getByRole("radio", { name: "kg" }));

    expect(accountClient.updatePreferences).not.toHaveBeenCalled();
  });

  it("shows a safe error and does not reload when saving fails", async () => {
    const user = userEvent.setup();
    const reload = mockAccount("kg");
    vi.mocked(accountClient.updatePreferences).mockRejectedValue(
      new NetworkError(new TypeError("offline")),
    );
    render(<DisplayUnitSetting />);

    await user.click(screen.getByRole("radio", { name: "lb" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
    expect(reload).not.toHaveBeenCalled();
  });
});
