import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { deleteGoal, updateGoal } from "@/lib/api/accountClient";
import { ApiError } from "@/lib/api/errors";
import type { MeOut } from "@/lib/api/types";
import { GoalSetting } from "../GoalSetting";

vi.mock("@/lib/api/accountClient", () => ({
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

function mockAccount(goal: MeOut["goal"]) {
  const reloadAccount = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: {
      user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
      preferences: { display_unit: "kg" },
      goal,
      measurement_count: 3,
    },
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

const weightField = () => screen.getByLabelText<HTMLInputElement>(/Target weight/);
const rateField = () => screen.getByLabelText<HTMLInputElement>(/Target rate/);

afterEach(() => {
  vi.resetAllMocks();
});

describe("GoalSetting", () => {
  it("shows an honest no-goal state with empty fields and no Remove action", () => {
    mockAccount(null);
    render(<GoalSetting unit="kg" />);

    expect(screen.getByText(/No goal is set/)).toBeInTheDocument();
    expect(weightField().value).toBe("");
    expect(rateField().value).toBe("");
    expect(screen.queryByRole("button", { name: "Remove goal" })).not.toBeInTheDocument();
  });

  it("loads an existing stored goal into the fields", () => {
    mockAccount({ target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 });
    render(<GoalSetting unit="kg" />);

    expect(weightField().value).toBe("78.5");
    expect(rateField().value).toBe("-0.5");
    expect(screen.getByRole("button", { name: "Remove goal" })).toBeInTheDocument();
  });

  it("shows a stored kilogram goal converted into the display unit", () => {
    mockAccount({ target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 });
    render(<GoalSetting unit="lb" />);

    expect(screen.getByLabelText("Target weight (lb, optional)")).toHaveValue(173.1);
    expect(screen.getByLabelText("Target rate (lb/week, optional)")).toHaveValue(-1.1);
  });

  it("saves a target weight alone, as kilograms, and re-reads the account", async () => {
    const user = userEvent.setup();
    const reload = mockAccount(null);
    vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 78.5, target_weekly_rate_kg: null });
    render(<GoalSetting unit="kg" />);

    await user.type(weightField(), "78.5");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    await waitFor(() =>
      expect(updateGoal).toHaveBeenCalledWith({
        target_weight_kg: 78.5,
        target_weekly_rate_kg: null,
      }),
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Goal saved.")).toBeInTheDocument();
  });

  it("saves an optional target rate alongside the weight", async () => {
    const user = userEvent.setup();
    mockAccount(null);
    vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 });
    render(<GoalSetting unit="kg" />);

    await user.type(weightField(), "78.5");
    await user.type(rateField(), "-0.5");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    await waitFor(() =>
      expect(updateGoal).toHaveBeenCalledWith({
        target_weight_kg: 78.5,
        target_weekly_rate_kg: -0.5,
      }),
    );
  });

  it("converts pounds to kilograms with the shared unit helper before saving", async () => {
    const user = userEvent.setup();
    mockAccount(null);
    vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 77.11, target_weekly_rate_kg: null });
    render(<GoalSetting unit="lb" />);

    await user.type(weightField(), "170");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(updateGoal).mock.calls[0]![0];
    expect(sent.target_weight_kg).toBeCloseTo(170 * 0.45359237, 6);
  });

  it("rejects a target weight outside the accepted bounds without calling the API", async () => {
    const user = userEvent.setup();
    mockAccount(null);
    render(<GoalSetting unit="kg" />);

    await user.type(weightField(), "900");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a target weight between 20.0 kg and 400.0 kg.",
    );
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("rejects a target rate outside the accepted bounds without calling the API", async () => {
    const user = userEvent.setup();
    mockAccount(null);
    render(<GoalSetting unit="kg" />);

    await user.type(rateField(), "9");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a target rate between/);
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("asks for a value rather than saving an empty goal", async () => {
    const user = userEvent.setup();
    mockAccount(null);
    render(<GoalSetting unit="kg" />);

    await user.click(screen.getByRole("button", { name: "Save goal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a target weight, a target rate/);
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it("removes the stored goal, clears the fields and re-reads the account", async () => {
    const user = userEvent.setup();
    const reload = mockAccount({ target_weight_kg: 78.5, target_weekly_rate_kg: null });
    vi.mocked(deleteGoal).mockResolvedValue(undefined);
    render(<GoalSetting unit="kg" />);

    await user.click(screen.getByRole("button", { name: "Remove goal" }));

    await waitFor(() => expect(deleteGoal).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(weightField().value).toBe("");
    expect(await screen.findByText("Goal removed.")).toBeInTheDocument();
  });

  it("shows the backend's safe message when saving is rejected", async () => {
    const user = userEvent.setup();
    const reload = mockAccount(null);
    vi.mocked(updateGoal).mockRejectedValue(
      new ApiError(422, { code: "validation_error", message: "The request was rejected." }),
    );
    render(<GoalSetting unit="kg" />);

    await user.type(weightField(), "78.5");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The request was rejected.");
    expect(reload).not.toHaveBeenCalled();
  });

  describe("round-trip through a rounded display unit", () => {
    // 78.5 kg displays as 173.1 lb, which converts back to 78.51647... kg; -0.5 kg/week displays
    // as -1.1 lb/week (-0.49895... kg). Re-deriving either from its display text would move the
    // stored value.
    const STORED = { target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 };

    it("makes no request when a stored kg goal shown in lb is saved without an edit", async () => {
      const user = userEvent.setup();
      const reload = mockAccount(STORED);
      render(<GoalSetting unit="lb" />);

      expect(weightField().value).toBe("173.1");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      expect(updateGoal).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("No changes to save.");
    });

    it("keeps an unedited field's canonical kilograms exactly when only the other field changes", async () => {
      const user = userEvent.setup();
      mockAccount(STORED);
      vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 78.5, target_weekly_rate_kg: -0.9 });
      render(<GoalSetting unit="lb" />);

      await user.clear(rateField());
      await user.type(rateField(), "-2");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      const sent = vi.mocked(updateGoal).mock.calls[0]![0];
      expect(sent.target_weight_kg).toBe(78.5);
      expect(sent.target_weekly_rate_kg).toBeCloseTo(-2 * 0.45359237, 9);
    });

    it("persists a real edit to a field shown in lb, converted from what was typed", async () => {
      const user = userEvent.setup();
      mockAccount(STORED);
      vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 77.11, target_weekly_rate_kg: -0.5 });
      render(<GoalSetting unit="lb" />);

      await user.clear(weightField());
      await user.type(weightField(), "170");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      const sent = vi.mocked(updateGoal).mock.calls[0]![0];
      expect(sent.target_weight_kg).toBeCloseTo(170 * 0.45359237, 9);
      expect(sent.target_weekly_rate_kg).toBe(-0.5);
    });

    it("treats a value typed back to its displayed text as unchanged", async () => {
      const user = userEvent.setup();
      mockAccount(STORED);
      render(<GoalSetting unit="lb" />);

      await user.clear(weightField());
      await user.type(weightField(), "173.1");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      expect(updateGoal).not.toHaveBeenCalled();
    });

    it("does not drift across repeated saves after an edit", async () => {
      const user = userEvent.setup();
      mockAccount(STORED);
      vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 77.11, target_weekly_rate_kg: -0.5 });
      render(<GoalSetting unit="lb" />);

      await user.clear(weightField());
      await user.type(weightField(), "170");
      await user.click(screen.getByRole("button", { name: "Save goal" }));
      await screen.findByText("Goal saved.");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      expect(updateGoal).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("No changes to save.");
    });

    it("kg mode: an unedited save makes no request and an edit sends exactly what was typed", async () => {
      const user = userEvent.setup();
      mockAccount(STORED);
      vi.mocked(updateGoal).mockResolvedValue({ target_weight_kg: 77.2, target_weekly_rate_kg: -0.5 });
      render(<GoalSetting unit="kg" />);

      await user.click(screen.getByRole("button", { name: "Save goal" }));
      expect(updateGoal).not.toHaveBeenCalled();

      await user.clear(weightField());
      await user.type(weightField(), "77.2");
      await user.click(screen.getByRole("button", { name: "Save goal" }));

      await waitFor(() =>
        expect(updateGoal).toHaveBeenCalledWith({
          target_weight_kg: 77.2,
          target_weekly_rate_kg: -0.5,
        }),
      );
    });
  });

  it("says the goal is never used in the estimate, and claims no ETA or progress", () => {
    mockAccount({ target_weight_kg: 78.5, target_weekly_rate_kg: -0.5 });
    render(<GoalSetting unit="kg" />);

    expect(screen.getByText(/never used in the estimate/)).toBeInTheDocument();
    expect(screen.queryByText(/on track|on.plan|ETA|reach your goal by|ahead|behind/i)).toBeNull();
  });
});
