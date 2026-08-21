import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DemoScenarioError from "../error";

describe("DemoScenarioError", () => {
  it("explains the failure without rendering a number", () => {
    render(<DemoScenarioError error={new Error("fetch failed")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /analysis service is unavailable/i })).toBeInTheDocument();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it("never renders the underlying error message", () => {
    // The thrown error can originate anywhere, including a third-party exception whose
    // message is not ours to trust -- this boundary must not echo it.
    render(<DemoScenarioError error={new Error("ECONNREFUSED 127.0.0.1:8010")} reset={vi.fn()} />);
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it("retries by calling reset", async () => {
    const reset = vi.fn();
    render(<DemoScenarioError error={new Error("fetch failed")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
