import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteAccount as deleteAccountRequest,
  getCurrentAccount,
  logout as logoutRequest,
} from "@/lib/api/accountClient";
import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { MeOut } from "@/lib/api/types";
import { AccountProvider, useAccount } from "../AccountProvider";

vi.mock("@/lib/api/accountClient", () => ({
  getCurrentAccount: vi.fn(),
  logout: vi.fn(),
  deleteAccount: vi.fn(),
}));

const ME: MeOut = {
  user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
  preferences: { display_unit: "kg" },
  goal: null,
  measurement_count: 3,
};

const ME_WITH_MORE: MeOut = { ...ME, measurement_count: 4 };

function Consumer() {
  const {
    status,
    account,
    errorMessage,
    refresh,
    signedIn,
    logout,
    dataVersion,
    notifyMeasurementsChanged,
    reloadAccount,
    deleteAccount,
  } = useAccount();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{account?.user.email ?? ""}</span>
      <span data-testid="count">{account?.measurement_count ?? ""}</span>
      <span data-testid="error">{errorMessage ?? ""}</span>
      <span data-testid="dataVersion">{dataVersion}</span>
      <button onClick={refresh}>refresh</button>
      <button onClick={() => signedIn(ME)}>mark signed in</button>
      <button onClick={() => void logout()}>sign out</button>
      <button onClick={() => void notifyMeasurementsChanged()}>notify</button>
      <span data-testid="unit">{account?.preferences.display_unit ?? ""}</span>
      <button onClick={() => void reloadAccount()}>reload</button>
      <button onClick={() => void deleteAccount("reader@example.com").catch(() => {})}>
        delete account
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AccountProvider>
      <Consumer />
    </AccountProvider>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AccountProvider", () => {
  it("starts loading, then reflects an authenticated account on success", async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(ME);

    renderProvider();

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("reader@example.com");
    expect(getCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it("reflects unauthenticated on a 401, without treating it as an error", async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new UnauthorizedError(undefined));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("reflects a recoverable error, distinct from unauthenticated, on a network failure", async () => {
    vi.mocked(getCurrentAccount).mockRejectedValue(new NetworkError(new TypeError("offline")));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("error")).toHaveTextContent("Could not reach the analysis service.");
  });

  it("refresh() re-runs the account check", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockRejectedValueOnce(new NetworkError(new TypeError("offline")));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));

    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME);
    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(getCurrentAccount).toHaveBeenCalledTimes(2);
  });

  it("signedIn() sets the account without issuing a second GET /api/me", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockRejectedValue(new UnauthorizedError(undefined));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await user.click(screen.getByRole("button", { name: "mark signed in" }));

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("email")).toHaveTextContent("reader@example.com");
    expect(getCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it("logout() calls the endpoint and clears in-memory account state", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValue(ME);
    vi.mocked(logoutRequest).mockResolvedValue(undefined);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "sign out" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(logoutRequest).toHaveBeenCalledTimes(1);
  });

  it("notifyMeasurementsChanged() re-fetches the account and bumps dataVersion", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("3"));
    expect(screen.getByTestId("dataVersion")).toHaveTextContent("0");

    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME_WITH_MORE);
    await user.click(screen.getByRole("button", { name: "notify" }));

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("4"));
    expect(screen.getByTestId("dataVersion")).toHaveTextContent("1");
    expect(getCurrentAccount).toHaveBeenCalledTimes(2);
  });

  it("notifyMeasurementsChanged() still bumps dataVersion when the re-fetch fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    vi.mocked(getCurrentAccount).mockRejectedValueOnce(new NetworkError(new TypeError("offline")));
    await user.click(screen.getByRole("button", { name: "notify" }));

    await waitFor(() => expect(screen.getByTestId("dataVersion")).toHaveTextContent("1"));
    // A transient failure here doesn't misreport the reader as signed out, and doesn't discard
    // the last known account either -- only a genuine 401 does that.
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("count")).toHaveTextContent("3");
  });

  it("notifyMeasurementsChanged() signs the reader out on a 401", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    vi.mocked(getCurrentAccount).mockRejectedValueOnce(new UnauthorizedError(undefined));
    await user.click(screen.getByRole("button", { name: "notify" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("");
  });

  it("reloadAccount() picks up a stored preference change without bumping dataVersion", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValueOnce(ME);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("unit")).toHaveTextContent("kg"));

    vi.mocked(getCurrentAccount).mockResolvedValueOnce({
      ...ME,
      preferences: { display_unit: "lb" },
    });
    await user.click(screen.getByRole("button", { name: "reload" }));

    await waitFor(() => expect(screen.getByTestId("unit")).toHaveTextContent("lb"));
    // A preference or goal change cannot alter the analysis, so it must not invalidate it.
    expect(screen.getByTestId("dataVersion")).toHaveTextContent("0");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("deleteAccount() calls the endpoint and clears in-memory account state", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValue(ME);
    vi.mocked(deleteAccountRequest).mockResolvedValue(undefined);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "delete account" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(deleteAccountRequest).toHaveBeenCalledWith("reader@example.com");
    expect(screen.getByTestId("email")).toHaveTextContent("");
  });

  it("deleteAccount() leaves the account signed in when the backend rejects it", async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentAccount).mockResolvedValue(ME);
    vi.mocked(deleteAccountRequest).mockRejectedValue(
      new ApiError(422, { code: "confirmation_mismatch", message: "No match." }),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "delete account" }));

    await waitFor(() => expect(deleteAccountRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("email")).toHaveTextContent("reader@example.com");
  });
});
