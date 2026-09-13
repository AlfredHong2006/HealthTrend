import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountJsonExport, getMeasurementsCsvExport } from "@/lib/api/accountClient";
import { UnauthorizedError } from "@/lib/api/errors";
import { ExportSetting } from "../ExportSetting";

vi.mock("@/lib/api/accountClient", () => ({
  getMeasurementsCsvExport: vi.fn(),
  getAccountJsonExport: vi.fn(),
}));

// jsdom implements neither object URLs nor download navigation; both are stubbed so the test can
// observe what would be handed to the browser.
const createObjectURL = vi.fn(() => "blob:export");
const revokeObjectURL = vi.fn();
let clickSpy: ReturnType<typeof vi.spyOn>;
let downloadNames: string[];

beforeEach(() => {
  downloadNames = [];
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloadNames.push(this.download);
    });
});

afterEach(() => {
  vi.resetAllMocks();
  clickSpy.mockRestore();
});

describe("ExportSetting", () => {
  it("labels the two exports by their different scopes", () => {
    render(<ExportSetting />);

    expect(screen.getByRole("button", { name: "Download measurements (CSV)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download account data (JSON)" })).toBeInTheDocument();
    expect(screen.getByText(/stored measurements only/)).toBeInTheDocument();
    expect(screen.getByText(/does not include your goal or settings/)).toBeInTheDocument();
    expect(screen.getByText(/account data HealthTrend stores for you/)).toBeInTheDocument();
  });

  it("makes no claim to be a complete backup or to include data HealthTrend does not store", () => {
    render(<ExportSetting />);

    expect(screen.queryByText(/backup|everything|server logs|provider/i)).toBeNull();
  });

  it("downloads the measurement CSV from its own endpoint, and lets go of it", async () => {
    const user = userEvent.setup();
    vi.mocked(getMeasurementsCsvExport).mockResolvedValue(new Blob(["timestamp,weight,unit\n"]));
    render(<ExportSetting />);

    await user.click(screen.getByRole("button", { name: "Download measurements (CSV)" }));

    await waitFor(() => expect(downloadNames).toEqual(["healthtrend-measurements.csv"]));
    expect(getMeasurementsCsvExport).toHaveBeenCalledTimes(1);
    expect(getAccountJsonExport).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });

  it("downloads the JSON account export from a distinct endpoint", async () => {
    const user = userEvent.setup();
    vi.mocked(getAccountJsonExport).mockResolvedValue(new Blob(['{"export_version":1}']));
    render(<ExportSetting />);

    await user.click(screen.getByRole("button", { name: "Download account data (JSON)" }));

    await waitFor(() => expect(downloadNames).toEqual(["healthtrend-account-export.json"]));
    expect(getAccountJsonExport).toHaveBeenCalledTimes(1);
    expect(getMeasurementsCsvExport).not.toHaveBeenCalled();
  });

  it("shows a safe message, and saves nothing, when an export fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getAccountJsonExport).mockRejectedValue(
      new UnauthorizedError({ code: "not_signed_in", message: "You are not signed in." }),
    );
    render(<ExportSetting />);

    await user.click(screen.getByRole("button", { name: "Download account data (JSON)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You are not signed in.");
    expect(downloadNames).toEqual([]);
  });
});
