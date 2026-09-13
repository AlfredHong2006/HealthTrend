import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { createMeasurement } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { MeasurementOut, MeOut } from "@/lib/api/types";
import { QuickLog } from "../QuickLog";

vi.mock("@/lib/api/accountClient", () => ({
  createMeasurement: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

function meWith(displayUnit: "kg" | "lb"): MeOut {
  return {
    user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
    preferences: { display_unit: displayUnit },
    goal: null,
    measurement_count: 2,
  };
}

function mockAccount(account: MeOut | null, notifyMeasurementsChanged = vi.fn()) {
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account,
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged,
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
}

function weightInput() {
  return screen.getByLabelText("Weight");
}

function dateInput(): HTMLInputElement {
  return screen.getByLabelText("Date and time");
}

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("QuickLog", () => {
  it("renders weight, unit and date/time fields", () => {
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);

    expect(weightInput()).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Unit" })).toBeInTheDocument();
    expect(dateInput()).toBeInTheDocument();
  });

  it("defaults the unit from the account's display preference", () => {
    mockAccount(meWith("lb"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);

    expect(screen.getByRole("radio", { name: "lb" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "kg" })).not.toBeChecked();
  });

  it("lets the reader change the unit for this reading without touching account preferences", async () => {
    const user = userEvent.setup();
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);
    await user.click(screen.getByRole("radio", { name: "lb" }));

    expect(screen.getByRole("radio", { name: "lb" })).toBeChecked();
    // No preferences call exists on this client at all -- switching the unit here can only
    // ever be reflected in the ObservationIn this page submits.
  });

  it("defaults the date/time to the current local instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 26, 8, 50)); // 26 Apr 2026, 08:50 local
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);

    expect(dateInput().value).toBe("2026-04-26T08:50");
  });

  it("rejects a non-numeric or non-positive weight without submitting", async () => {
    const user = userEvent.setup();
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);
    await user.type(weightInput(), "not a number");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a weight greater than zero.");
    expect(createMeasurement).not.toHaveBeenCalled();
  });

  it("submits the exact ObservationIn the fields describe", async () => {
    const user = userEvent.setup();
    vi.mocked(createMeasurement).mockResolvedValue({
      id: "m1",
      timestamp: "2026-04-26T07:50:00.000Z",
      weight: 82.4,
      unit: "kg",
      source: "manual",
      created_at: "2026-04-26T07:50:00.000Z",
      updated_at: "2026-04-26T07:50:00.000Z",
    });
    const notify = vi.fn().mockResolvedValue(undefined);
    const replace = vi.fn();
    mockAccount(meWith("kg"), notify);
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

    render(<QuickLog />);
    await user.clear(weightInput());
    await user.type(weightInput(), "82.4");
    await user.clear(dateInput());
    await user.type(dateInput(), "2026-04-26T08:50");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createMeasurement).toHaveBeenCalledTimes(1));
    expect(createMeasurement).toHaveBeenCalledWith({
      timestamp: new Date(2026, 3, 26, 8, 50).toISOString(),
      weight: 82.4,
      unit: "kg",
    });
  });

  it("disables submission while a save is in flight, and does not double-submit", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: MeasurementOut) => void;
    vi.mocked(createMeasurement).mockReturnValue(
      new Promise<MeasurementOut>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);
    await user.type(weightInput(), "82.4");
    const submit = screen.getByRole("button", { name: "Save" });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(createMeasurement).toHaveBeenCalledTimes(1);

    resolveCreate({
      id: "m1",
      timestamp: "2026-04-26T07:50:00.000Z",
      weight: 82.4,
      unit: "kg",
      source: "manual",
      created_at: "2026-04-26T07:50:00.000Z",
      updated_at: "2026-04-26T07:50:00.000Z",
    });
  });

  it("triggers the account refresh and routes to /app on success", async () => {
    const user = userEvent.setup();
    vi.mocked(createMeasurement).mockResolvedValue({
      id: "m1",
      timestamp: "2026-04-26T07:50:00.000Z",
      weight: 82.4,
      unit: "kg",
      source: "manual",
      created_at: "2026-04-26T07:50:00.000Z",
      updated_at: "2026-04-26T07:50:00.000Z",
    });
    const notify = vi.fn().mockResolvedValue(undefined);
    const replace = vi.fn();
    mockAccount(meWith("kg"), notify);
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

    render(<QuickLog />);
    await user.type(weightInput(), "82.4");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/app");
  });

  it("stays on the page and shows the API error when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(createMeasurement).mockRejectedValue(
      new ApiError(422, { code: "measurement_cap_reached", message: "You have reached the limit." }),
    );
    const replace = vi.fn();
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

    render(<QuickLog />);
    await user.type(weightInput(), "82.4");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("You have reached the limit."),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("degrades to a generic message on a network failure", async () => {
    const user = userEvent.setup();
    vi.mocked(createMeasurement).mockRejectedValue(new NetworkError(new TypeError("offline")));
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    render(<QuickLog />);
    await user.type(weightInput(), "82.4");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the analysis service."),
    );
  });

  it("has no detectable accessibility violations", async () => {
    mockAccount(meWith("kg"));
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    const { container } = render(<QuickLog />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
