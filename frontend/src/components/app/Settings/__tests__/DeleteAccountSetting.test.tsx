import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { DeleteAccountSetting } from "../DeleteAccountSetting";

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

function setup(deleteAccount = vi.fn().mockResolvedValue(undefined)) {
  const replace = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: {
      user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
      preferences: { display_unit: "kg" },
      goal: null,
      measurement_count: 3,
    },
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount,
  });
  const user = userEvent.setup();
  render(<DeleteAccountSetting />);
  return { user, replace, deleteAccount };
}

const confirmButton = () => screen.getByRole("button", { name: "Permanently delete account" });

afterEach(() => {
  vi.resetAllMocks();
});

describe("DeleteAccountSetting", () => {
  it("explains plainly what deletion removes, without promising more", () => {
    setup();

    expect(screen.getByText(/permanently removes the data HealthTrend stores/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.queryByText(/backup|retention|restore within/i)).toBeNull();
  });

  it("requires opening the form and typing the account email before deletion is possible", async () => {
    const { user, deleteAccount } = setup();

    expect(screen.queryByRole("button", { name: "Permanently delete account" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete account…" }));

    expect(confirmButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Type your email address to confirm"), "reader@example");
    expect(confirmButton()).toBeDisabled();
    await user.click(confirmButton());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("does not fire for a different address", async () => {
    const { user, deleteAccount } = setup();
    await user.click(screen.getByRole("button", { name: "Delete account…" }));

    await user.type(screen.getByLabelText("Type your email address to confirm"), "other@example.com");

    expect(confirmButton()).toBeDisabled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("sends the typed confirmation, clears the account and routes to sign-in", async () => {
    const { user, deleteAccount, replace } = setup();
    await user.click(screen.getByRole("button", { name: "Delete account…" }));

    await user.type(
      screen.getByLabelText("Type your email address to confirm"),
      " Reader@Example.com ",
    );
    await user.click(confirmButton());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("Reader@Example.com"));
    expect(replace).toHaveBeenCalledWith("/app/sign-in");
  });

  it("stays on the page with the backend's safe message when deletion is rejected", async () => {
    const { user, replace } = setup(
      vi.fn().mockRejectedValue(
        new ApiError(422, {
          code: "confirmation_mismatch",
          message: "The email address does not match this account.",
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Delete account…" }));
    await user.type(screen.getByLabelText("Type your email address to confirm"), "reader@example.com");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email address does not match this account.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(confirmButton()).toBeEnabled();
  });

  it("stays on the page when the backend cannot be reached", async () => {
    const { user, replace } = setup(vi.fn().mockRejectedValue(new NetworkError(new TypeError("x"))));
    await user.click(screen.getByRole("button", { name: "Delete account…" }));
    await user.type(screen.getByLabelText("Type your email address to confirm"), "reader@example.com");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("cancel closes the form without deleting", async () => {
    const { user, deleteAccount } = setup();
    await user.click(screen.getByRole("button", { name: "Delete account…" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Type your email address to confirm")).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
