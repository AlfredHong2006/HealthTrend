import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { importMeasurementsBatch } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { CsvIngestResponse } from "@/lib/api/types";
import { AccountImport } from "../AccountImport";

/**
 * The real `CsvImport` renders here -- only its network call (`ingestCsv`) and the batch store are
 * mocked -- so these tests exercise the actual reused parse-and-review path, not a stand-in.
 */

const { ingestCsv } = vi.hoisted(() => ({ ingestCsv: vi.fn() }));
vi.mock("@/lib/api/browserClient", () => ({ ingestCsv }));

vi.mock("@/lib/api/accountClient", () => ({
  importMeasurementsBatch: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

const PARSED: CsvIngestResponse = {
  accepted: [
    { timestamp: "2026-05-01T07:00:00Z", weight: 72.4, unit: "kg" },
    { timestamp: "2026-05-02T07:00:00Z", weight: 72.1, unit: "kg" },
  ],
  rejected: [],
  issues_truncated: false,
  accepted_count: 2,
  rejected_count: 0,
  duplicate_count: 0,
  blank_rows_skipped: 0,
  naive_timestamp_count: 0,
  date_only_count: 0,
};

function mockUseAccount() {
  const notifyMeasurementsChanged = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: {
      user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
      preferences: { display_unit: "kg" },
      goal: null,
      measurement_count: 0,
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

async function readFileAndReview() {
  const input = screen.getByLabelText("CSV file") as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["timestamp,weight\n"], "history.csv", { type: "text/csv" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Read file" }));
  return screen.findByRole("button", { name: "Add 2 measurements to history" });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AccountImport", () => {
  it("explains that accepted rows are added to the account and repeats are not added again", () => {
    mockUseAccount();
    render(<AccountImport />);

    expect(screen.getByText(/added to your signed-in account history/)).toBeInTheDocument();
    expect(screen.getByText(/importing the same file twice adds nothing new/)).toBeInTheDocument();
  });

  it("reuses the existing CSV parser, then stores exactly the accepted rows", async () => {
    const notify = mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 2,
      skipped_existing_count: 0,
    });
    render(<AccountImport />);

    fireEvent.click(await readFileAndReview());

    await waitFor(() => expect(importMeasurementsBatch).toHaveBeenCalledWith(PARSED.accepted));
    expect(ingestCsv).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  });

  it("reports the real inserted and skipped counts, with real onward links", async () => {
    mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 142,
      skipped_existing_count: 3,
    });
    render(<AccountImport />);

    fireEvent.click(await readFileAndReview());

    expect(await screen.findByText("Added 142 measurements to your history.")).toBeInTheDocument();
    expect(
      screen.getByText("3 were already stored for this account, so they were not added again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View trend" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "View history" })).toHaveAttribute(
      "href",
      "/app/measurements",
    );
  });

  it("says plainly when every row was already stored", async () => {
    mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 0,
      skipped_existing_count: 2,
    });
    render(<AccountImport />);

    fireEvent.click(await readFileAndReview());

    expect(await screen.findByText("No new measurements were added.")).toBeInTheDocument();
    expect(
      screen.getByText("2 were already stored for this account, so they were not added again."),
    ).toBeInTheDocument();
  });

  it("never stores anything when the parser rejects the file", async () => {
    mockUseAccount();
    ingestCsv.mockRejectedValue(
      new ApiError(422, { code: "csv_no_weight_column", message: "No weight column was found." }),
    );
    render(<AccountImport />);

    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x\n"], "bad.csv", { type: "text/csv" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Read file" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No weight column was found.");
    expect(importMeasurementsBatch).not.toHaveBeenCalled();
  });

  it("stays on the review, shows the error and does not refresh when storing fails", async () => {
    const notify = mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockRejectedValue(
      new ApiError(422, {
        code: "measurement_limit_exceeded",
        message: "This import would exceed the measurement limit.",
      }),
    );
    render(<AccountImport />);

    fireEvent.click(await readFileAndReview());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This import would exceed the measurement limit.",
    );
    expect(notify).not.toHaveBeenCalled();
    expect(screen.queryByText(/Added/)).not.toBeInTheDocument();
  });

  it("degrades to the network message when the backend cannot be reached", async () => {
    mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockRejectedValue(new NetworkError(new TypeError("offline")));
    render(<AccountImport />);

    fireEvent.click(await readFileAndReview());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
  });

  it("can start another import from the outcome", async () => {
    mockUseAccount();
    ingestCsv.mockResolvedValue(PARSED);
    vi.mocked(importMeasurementsBatch).mockResolvedValue({
      inserted_count: 2,
      skipped_existing_count: 0,
    });
    render(<AccountImport />);
    fireEvent.click(await readFileAndReview());

    fireEvent.click(await screen.findByRole("button", { name: "Import another file" }));

    expect(screen.getByLabelText("CSV file")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    mockUseAccount();
    const { container } = render(<AccountImport />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
