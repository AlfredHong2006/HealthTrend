import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CsvIngestResponse, ObservationIn } from "@/lib/api/types";
import { CsvImport } from "../CsvImport";

const { ingestCsv } = vi.hoisted(() => ({ ingestCsv: vi.fn() }));
vi.mock("@/lib/api/browserClient", () => ({ ingestCsv }));

function csvFile(name = "history.csv"): File {
  return new File(["timestamp,weight\n2026-05-01T07:00:00Z,72.4\n"], name, { type: "text/csv" });
}

function selectFile(file: File = csvFile()) {
  const input = screen.getByLabelText("CSV file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

function readFile() {
  fireEvent.click(screen.getByRole("button", { name: "Read file" }));
}

interface RenderOptions {
  onSubmit?: (observations: ObservationIn[]) => void;
  submitting?: boolean;
  submitError?: string | null;
  onInputsChanged?: () => void;
}

function renderCsvImport(options: RenderOptions = {}) {
  // Always a real vi.fn(), so callers get a statically-typed Mock (`.mockClear()` etc.)
  // back regardless of whether an override was supplied for the component itself.
  const onInputsChangedSpy = vi.fn();
  render(
    <CsvImport
      onSubmit={options.onSubmit ?? vi.fn()}
      submitting={options.submitting ?? false}
      submitError={options.submitError ?? null}
      onInputsChanged={options.onInputsChanged ?? onInputsChangedSpy}
    />,
  );
  return { onInputsChanged: onInputsChangedSpy };
}

const SUCCESS_RESULT: CsvIngestResponse = {
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

const NOTHING_ACCEPTED_RESULT: CsvIngestResponse = {
  ...SUCCESS_RESULT,
  accepted: [],
  accepted_count: 0,
  rejected: [{ line: 3, reason_code: "missing_weight", message: "This row is missing a weight." }],
  rejected_count: 1,
};

describe("CsvImport", () => {
  it("pre-fills the timezone field with a valid detected zone", () => {
    renderCsvImport();
    const timezoneInput = screen.getByLabelText(/Timezone/) as HTMLInputElement;
    expect(timezoneInput.value.length).toBeGreaterThan(0);
  });

  it("requires a file before reading", () => {
    renderCsvImport();
    readFile();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a CSV file.");
    expect(ingestCsv).not.toHaveBeenCalled();
  });

  it("rejects an obviously invalid timezone before uploading", () => {
    renderCsvImport();
    selectFile();
    fireEvent.change(screen.getByLabelText(/Timezone/), { target: { value: "Not/A_Real_Zone" } });
    readFile();

    expect(screen.getByRole("alert")).toHaveTextContent(/valid timezone/);
    expect(ingestCsv).not.toHaveBeenCalled();
  });

  it("reads a file and shows a summary, preview, and an enabled Analyse action", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    renderCsvImport();

    selectFile();
    readFile();

    expect(await screen.findByRole("status")).toHaveTextContent("2 accepted");
    expect(screen.getByRole("button", { name: "Analyse 2 measurements" })).toBeEnabled();
  });

  it("shows rejected rows with their line number and reason", async () => {
    ingestCsv.mockResolvedValueOnce(NOTHING_ACCEPTED_RESULT);
    renderCsvImport();

    selectFile();
    readFile();

    expect(
      await screen.findByText("Line 3: This row is missing a weight."),
    ).toBeInTheDocument();
  });

  it("disables Analyse when nothing was accepted", async () => {
    ingestCsv.mockResolvedValueOnce(NOTHING_ACCEPTED_RESULT);
    renderCsvImport();

    selectFile();
    readFile();

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyse 0 measurements" })).toBeDisabled();
  });

  it("calls onSubmit with the accepted observations, unchanged", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    const onSubmit = vi.fn();
    renderCsvImport({ onSubmit });

    selectFile();
    readFile();
    fireEvent.click(await screen.findByRole("button", { name: "Analyse 2 measurements" }));

    expect(onSubmit).toHaveBeenCalledWith(SUCCESS_RESULT.accepted);
  });

  it("formats the preview weight to one decimal place, without touching the submitted data", async () => {
    const noisyResult: CsvIngestResponse = {
      ...SUCCESS_RESULT,
      accepted: [{ timestamp: "2026-05-01T07:00:00Z", weight: 70.00018890788002, unit: "kg" }],
      accepted_count: 1,
    };
    ingestCsv.mockResolvedValueOnce(noisyResult);
    const onSubmit = vi.fn();
    renderCsvImport({ onSubmit });

    selectFile();
    readFile();

    expect(await screen.findByText("70.0 kg")).toBeInTheDocument();
    expect(screen.queryByText(/70\.00018890788002/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analyse 1 measurement" }));
    expect(onSubmit).toHaveBeenCalledWith(noisyResult.accepted);
    expect(onSubmit.mock.calls[0]![0][0].weight).toBe(70.00018890788002);
  });

  it("sends the browser-canonicalised timezone, not the raw casing typed in", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    renderCsvImport();

    selectFile();
    fireEvent.change(screen.getByLabelText(/Timezone/), {
      target: { value: "america/new_york" },
    });
    readFile();

    await screen.findByRole("status");
    expect(ingestCsv).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assumedTimezone: "America/New_York" }),
    );
    expect((screen.getByLabelText(/Timezone/) as HTMLInputElement).value).toBe(
      "America/New_York",
    );
  });

  it("invalidates a previous result when the file selection changes", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    const { onInputsChanged } = renderCsvImport();

    selectFile();
    readFile();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    onInputsChanged.mockClear();

    selectFile(csvFile("other.csv"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Analyse/ })).not.toBeInTheDocument();
    expect(onInputsChanged).toHaveBeenCalledTimes(1);
  });

  it("invalidates a previous result when the timezone field changes", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    const { onInputsChanged } = renderCsvImport();

    selectFile();
    readFile();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    onInputsChanged.mockClear();

    fireEvent.change(screen.getByLabelText(/Timezone/), {
      target: { value: "America/New_York" },
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onInputsChanged).toHaveBeenCalledTimes(1);
  });

  it("invalidates a previous result when the default unit changes", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    const { onInputsChanged } = renderCsvImport();

    selectFile();
    readFile();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    onInputsChanged.mockClear();

    fireEvent.click(screen.getByRole("radio", { name: "lb" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onInputsChanged).toHaveBeenCalledTimes(1);
  });

  it("shows a submit-level error and disables Analyse while submitting", async () => {
    ingestCsv.mockResolvedValueOnce(SUCCESS_RESULT);
    renderCsvImport({ submitting: true, submitError: "boom" });

    selectFile();
    readFile();

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByRole("button", { name: "Analysing…" })).toBeDisabled();
  });
});
