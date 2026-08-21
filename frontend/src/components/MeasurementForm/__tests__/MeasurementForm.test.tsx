import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeasurementForm } from "../MeasurementForm";

function dateInputs() {
  return screen.getAllByLabelText("Date and time") as HTMLInputElement[];
}

function weightInputs() {
  return screen.getAllByLabelText(/Weight/) as HTMLInputElement[];
}

describe("MeasurementForm", () => {
  it("starts with one empty row", () => {
    render(<MeasurementForm onSubmit={vi.fn()} submitting={false} submitError={null} />);
    expect(dateInputs()).toHaveLength(1);
    expect(weightInputs()).toHaveLength(1);
  });

  it("adds a row when asked, and removes one when asked", () => {
    render(<MeasurementForm onSubmit={vi.fn()} submitting={false} submitError={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Add another measurement" }));
    expect(dateInputs()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
    expect(dateInputs()).toHaveLength(1);
  });

  it("submits one observation built from the filled row, in the selected unit", () => {
    const onSubmit = vi.fn();
    render(<MeasurementForm onSubmit={onSubmit} submitting={false} submitError={null} />);

    fireEvent.click(screen.getByRole("radio", { name: "lb" }));
    fireEvent.change(dateInputs()[0]!, { target: { value: "2026-08-21T07:30" } });
    fireEvent.change(weightInputs()[0]!, { target: { value: "160" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [observations] = onSubmit.mock.calls[0] as [{ timestamp: string; weight: number; unit: string }[]];
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ weight: 160, unit: "lb" });
    expect(observations[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("drops a fully blank row rather than treating it as an error", () => {
    const onSubmit = vi.fn();
    render(<MeasurementForm onSubmit={onSubmit} submitting={false} submitError={null} />);

    fireEvent.change(dateInputs()[0]!, { target: { value: "2026-08-21T07:30" } });
    fireEvent.change(weightInputs()[0]!, { target: { value: "72" } });
    fireEvent.click(screen.getByRole("button", { name: "Add another measurement" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [observations] = onSubmit.mock.calls[0] as [unknown[]];
    expect(observations).toHaveLength(1);
  });

  it("rejects submission when every row is blank", () => {
    const onSubmit = vi.fn();
    render(<MeasurementForm onSubmit={onSubmit} submitting={false} submitError={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one measurement.");
  });

  it("rejects a row with a weight but no date, and does not submit", () => {
    const onSubmit = vi.fn();
    render(<MeasurementForm onSubmit={onSubmit} submitting={false} submitError={null} />);

    fireEvent.change(weightInputs()[0]!, { target: { value: "72" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Row 1/);
  });

  it("rejects a non-positive weight", () => {
    const onSubmit = vi.fn();
    render(<MeasurementForm onSubmit={onSubmit} submitting={false} submitError={null} />);

    fireEvent.change(dateInputs()[0]!, { target: { value: "2026-08-21T07:30" } });
    fireEvent.change(weightInputs()[0]!, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyse" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/greater than zero/);
  });

  it("shows the submit-level error, and disables the button, while submitting", () => {
    render(<MeasurementForm onSubmit={vi.fn()} submitting={true} submitError="boom" />);
    expect(screen.getByRole("button", { name: "Analysing…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });

  it("marks every data input as not eligible for browser autofill", () => {
    render(<MeasurementForm onSubmit={vi.fn()} submitting={false} submitError={null} />);
    for (const input of [...dateInputs(), ...weightInputs()]) {
      expect(input).toHaveAttribute("autocomplete", "off");
    }
  });
});
