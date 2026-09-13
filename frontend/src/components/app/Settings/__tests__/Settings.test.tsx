import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { Settings } from "../Settings";

vi.mock("@/lib/api/accountClient", () => ({
  updatePreferences: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  getMeasurementsCsvExport: vi.fn(),
  getAccountJsonExport: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

function setup(logout = vi.fn().mockResolvedValue(undefined)) {
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
    logout,
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
  const user = userEvent.setup();
  const view = render(<Settings />);
  return { user, replace, logout, ...view };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("Settings", () => {
  it("has exactly the settings the backend stores, plus export, sign-out and deletion", () => {
    setup();

    for (const heading of ["Display unit", "Goal", "Data export", "Sign out", "Delete account"]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
  });

  it("signs out through the existing AccountProvider logout and routes to sign-in", async () => {
    const { user, logout, replace } = setup();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/app/sign-in");
  });

  it("stays on the page with a message when sign-out fails", async () => {
    const { user, replace } = setup(vi.fn().mockRejectedValue(new Error("offline")));

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out just now.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = setup();
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
