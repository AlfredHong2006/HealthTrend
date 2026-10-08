import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { getSyncConnections, revokeSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { SyncConnectionOut } from "@/lib/api/types";
import { ConnectedSourcesSetting } from "../ConnectedSourcesSetting";

vi.mock("@/lib/api/accountClient", () => ({
  getSyncConnections: vi.fn(),
  revokeSyncConnection: vi.fn(),
}));

const UNUSED: SyncConnectionOut = {
  id: "c1",
  source: "apple_health",
  label: "Apple Health",
  created_at: "2026-04-20T08:00:00Z",
  last_used_at: null,
};

const USED: SyncConnectionOut = {
  id: "c2",
  source: "apple_health",
  label: "Apple Health",
  created_at: "2026-04-21T08:00:00Z",
  last_used_at: "2026-04-23T12:00:00Z",
};

function setup(connections: SyncConnectionOut[]) {
  vi.mocked(getSyncConnections).mockResolvedValue({ count: connections.length, connections });
  const user = userEvent.setup();
  const view = render(<ConnectedSourcesSetting />);
  return { user, ...view };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("ConnectedSourcesSetting list", () => {
  it("shows a loading state before the list resolves", () => {
    vi.mocked(getSyncConnections).mockReturnValue(new Promise(() => {}));

    render(<ConnectedSourcesSetting />);

    expect(screen.getByText("Loading connected sources…")).toBeInTheDocument();
  });

  it("shows Apple Health as not connected, with a link to the setup page", async () => {
    setup([]);

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Apple Health")).toBeInTheDocument();
    expect(
      screen.getByText("Automatically import weight measurements using an iPhone Shortcut."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Apple Health" })).toHaveAttribute(
      "href",
      "/app/connect/apple-health",
    );
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
  });

  it("shows a connection that has never synced as connected, last used never", async () => {
    setup([UNUSED]);

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Last used: Never")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setup instructions" })).toHaveAttribute(
      "href",
      "/app/connect/apple-health",
    );
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    expect(screen.queryByText("Not connected")).toBeNull();
  });

  it("shows when a connection was last used", async () => {
    setup([USED]);

    expect(await screen.findByText(/^Last used: 23 April 2026, \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("lists every connection rather than assuming one", async () => {
    setup([USED, UNUSED]);

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText(/Last used: 23 April 2026/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Last used: Never")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Revoke/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Setup instructions" })).toHaveLength(1);
  });

  it("never shows a token when merely listing connections", async () => {
    const { container } = setup([USED]);

    await screen.findByText("Connected");

    expect(container.textContent).not.toMatch(/hts_/);
    expect(screen.queryByText(/token/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the backend's message when the list cannot be loaded", async () => {
    vi.mocked(getSyncConnections).mockRejectedValue(new NetworkError(new TypeError("offline")));

    render(<ConnectedSourcesSetting />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
    expect(screen.queryByText("Not connected")).toBeNull();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = setup([USED, UNUSED]);
    await screen.findAllByRole("listitem");

    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});

describe("ConnectedSourcesSetting revoke", () => {
  it("asks before revoking, and cancel leaves the connection alone", async () => {
    const { user } = setup([USED]);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));

    expect(screen.getByText(/Revoke this connection\?/)).toHaveTextContent(
      "Measurements already imported stay in your history.",
    );
    expect(revokeSyncConnection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/Revoke this connection\?/)).toBeNull();
    expect(revokeSyncConnection).not.toHaveBeenCalled();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("revokes the chosen connection, removes it, and says what did and did not happen", async () => {
    vi.mocked(revokeSyncConnection).mockResolvedValue(undefined);
    const { user } = setup([USED, UNUSED]);

    const rows = await screen.findAllByRole("listitem");
    await user.click(within(rows[1]!).getByRole("button", { name: /^Revoke/ }));
    await user.click(screen.getByRole("button", { name: "Revoke connection" }));

    await waitFor(() => expect(revokeSyncConnection).toHaveBeenCalledWith("c1"));
    expect(revokeSyncConnection).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Its token no longer works");
    expect(status).toHaveTextContent("Measurements already imported were not deleted.");
  });

  it("returns to not connected once the last connection is revoked", async () => {
    vi.mocked(revokeSyncConnection).mockResolvedValue(undefined);
    const { user } = setup([USED]);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Revoke connection" }));

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Apple Health" })).toBeInTheDocument();
  });

  it("treats an already-revoked connection (404) as revoked", async () => {
    vi.mocked(revokeSyncConnection).mockRejectedValue(
      new ApiError(404, {
        code: "sync_connection_not_found",
        message: "No sync connection was found under that id.",
      }),
    );
    const { user } = setup([USED]);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Revoke connection" }));

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the connection and shows a message when revoking fails", async () => {
    vi.mocked(revokeSyncConnection).mockRejectedValue(new NetworkError(new TypeError("offline")));
    const { user } = setup([USED]);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Revoke connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Revoke connection" })).toBeEnabled();
  });
});
