import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { deleteMeasurement, getMeasurements, updateMeasurement } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { MeasurementOut } from "@/lib/api/types";
import { MeasurementList } from "../MeasurementList";

vi.mock("@/lib/api/accountClient", () => ({
  getMeasurements: vi.fn(),
  updateMeasurement: vi.fn(),
  deleteMeasurement: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

const ROW_A: MeasurementOut = {
  id: "m1",
  timestamp: "2026-04-23T08:50:00Z",
  weight: 81.7,
  unit: "kg",
  source: "manual",
  created_at: "2026-04-23T08:50:00Z",
  updated_at: "2026-04-23T08:50:00Z",
};

const ROW_B: MeasurementOut = {
  id: "m2",
  timestamp: "2026-04-24T08:50:00Z",
  weight: 179.0,
  unit: "lb",
  source: "csv",
  created_at: "2026-04-24T08:50:00Z",
  updated_at: "2026-04-24T08:50:00Z",
};

function mockUseAccount(notifyMeasurementsChanged = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: {
      user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
      preferences: { display_unit: "kg" },
      goal: null,
      measurement_count: 2,
    },
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged,
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
  return notifyMeasurementsChanged;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("MeasurementList loading/error/empty", () => {
  it("shows a loading state before the list resolves", () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockReturnValue(new Promise(() => {}));

    render(<MeasurementList />);

    expect(screen.getByText("Loading your measurements…")).toBeInTheDocument();
  });

  it("shows a recoverable error when the list fails to load", async () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockRejectedValue(
      new ApiError(500, { code: "internal_error", message: "Something went wrong on our side." }),
    );

    render(<MeasurementList />);

    await waitFor(() =>
      expect(screen.getByText("Something went wrong on our side.")).toBeInTheDocument(),
    );
  });

  it("shows an honest empty state with a real link to /app/log", async () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 0, measurements: [] });

    render(<MeasurementList />);

    await waitFor(() =>
      expect(screen.getByText("No measurements are stored yet.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Log a reading" })).toHaveAttribute(
      "href",
      "/app/log",
    );
  });
});

describe("MeasurementList populated", () => {
  it("shows the stored weight and unit exactly as entered, in backend order", async () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 2, measurements: [ROW_A, ROW_B] });

    render(<MeasurementList />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("81.7 kg")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("179.0 lb")).toBeInTheDocument();
  });

  it("shows a restrained source indicator for an imported row, and none for a manual one", async () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 2, measurements: [ROW_A, ROW_B] });

    render(<MeasurementList />);

    const rows = await screen.findAllByRole("listitem");
    expect(within(rows[0]!).queryByText(/imported/)).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText(/imported/)).toBeInTheDocument();
  });
});

describe("MeasurementList edit", () => {
  it("opens edit pre-populated with the stored reading, and cancel leaves it unchanged", async () => {
    const user = userEvent.setup();
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 1, measurements: [ROW_A] });

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Edit 81\.7 kg/ }));

    expect(screen.getByLabelText("Weight")).toHaveValue(81.7);
    expect(screen.getByRole("radio", { name: "kg" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Weight")).not.toBeInTheDocument();
    expect(updateMeasurement).not.toHaveBeenCalled();
  });

  it("saves an edit, refreshes the list and invalidates account analysis", async () => {
    const user = userEvent.setup();
    const notify = mockUseAccount();
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce({ count: 1, measurements: [ROW_A] })
      .mockResolvedValueOnce({ count: 1, measurements: [{ ...ROW_A, weight: 82.3 }] });
    vi.mocked(updateMeasurement).mockResolvedValue({ ...ROW_A, weight: 82.3 });

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Edit 81\.7 kg/ }));
    const weightField = screen.getByLabelText("Weight");
    await user.clear(weightField);
    await user.type(weightField, "82.3");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateMeasurement).toHaveBeenCalledWith("m1", {
        // Round-tripped through the minute-precision `datetime-local` control, so this carries
        // milliseconds where the original stored value did not -- expected, not a bug.
        timestamp: "2026-04-23T08:50:00.000Z",
        weight: 82.3,
        unit: "kg",
      }),
    );
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("82.3 kg")).toBeInTheDocument());
    expect(getMeasurements).toHaveBeenCalledTimes(2);
  });

  it("shows the API error and stays in edit state when the update fails", async () => {
    const user = userEvent.setup();
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 1, measurements: [ROW_A] });
    vi.mocked(updateMeasurement).mockRejectedValue(new NetworkError(new TypeError("offline")));

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Edit 81\.7 kg/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the analysis service."),
    );
    expect(screen.getByLabelText("Weight")).toBeInTheDocument();
  });
});

describe("MeasurementList delete", () => {
  it("requires confirmation before deleting", async () => {
    const user = userEvent.setup();
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 1, measurements: [ROW_A] });

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Delete 81\.7 kg/ }));

    expect(
      screen.getByText(/Delete the 81\.7 kg reading from 23 April 2026\?/),
    ).toBeInTheDocument();
    expect(deleteMeasurement).not.toHaveBeenCalled();
  });

  it("cancel does nothing", async () => {
    const user = userEvent.setup();
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 1, measurements: [ROW_A] });

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Delete 81\.7 kg/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteMeasurement).not.toHaveBeenCalled();
    expect(screen.getByText("81.7 kg")).toBeInTheDocument();
  });

  it("confirming calls the delete endpoint, then refreshes the list and account", async () => {
    const user = userEvent.setup();
    const notify = mockUseAccount();
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce({ count: 2, measurements: [ROW_A, ROW_B] })
      .mockResolvedValueOnce({ count: 1, measurements: [ROW_B] });
    vi.mocked(deleteMeasurement).mockResolvedValue(undefined);

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Delete 81\.7 kg/ }));
    await user.click(screen.getByRole("button", { name: "Delete reading" }));

    await waitFor(() => expect(deleteMeasurement).toHaveBeenCalledWith("m1"));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("81.7 kg")).not.toBeInTheDocument());
    expect(getMeasurements).toHaveBeenCalledTimes(2);
  });

  it("deleting the last remaining measurement leaves the honest empty state, not stale rows", async () => {
    const user = userEvent.setup();
    mockUseAccount();
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce({ count: 1, measurements: [ROW_A] })
      .mockResolvedValueOnce({ count: 0, measurements: [] });
    vi.mocked(deleteMeasurement).mockResolvedValue(undefined);

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Delete 81\.7 kg/ }));
    await user.click(screen.getByRole("button", { name: "Delete reading" }));

    await waitFor(() =>
      expect(screen.getByText("No measurements are stored yet.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("81.7 kg")).not.toBeInTheDocument();
  });

  it("treats a 404 (already deleted) as settled rather than an error, and refreshes anyway", async () => {
    const user = userEvent.setup();
    const notify = mockUseAccount();
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce({ count: 1, measurements: [ROW_A] })
      .mockResolvedValueOnce({ count: 0, measurements: [] });
    vi.mocked(deleteMeasurement).mockRejectedValue(
      new ApiError(404, { code: "measurement_not_found", message: "No measurement exists under that id." }),
    );

    render(<MeasurementList />);
    await user.click(await screen.findByRole("button", { name: /Delete 81\.7 kg/ }));
    await user.click(screen.getByRole("button", { name: "Delete reading" }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // No raw id ever reaches the screen.
    expect(screen.queryByText("m1")).not.toBeInTheDocument();
  });
});

describe("MeasurementList accessibility", () => {
  it("has no detectable accessibility violations, populated", async () => {
    mockUseAccount();
    vi.mocked(getMeasurements).mockResolvedValue({ count: 2, measurements: [ROW_A, ROW_B] });

    const { container } = render(<MeasurementList />);
    await screen.findAllByRole("listitem");

    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
