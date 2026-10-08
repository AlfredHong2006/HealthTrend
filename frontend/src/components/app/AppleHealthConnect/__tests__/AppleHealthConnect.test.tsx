import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { SyncConnectionCreatedOut } from "@/lib/api/types";
import { APPLE_HEALTH_SHORTCUT_URL } from "@/lib/sync/appleHealthShortcut";
import { AppleHealthConnect } from "../AppleHealthConnect";

vi.mock("@/lib/api/accountClient", () => ({
  createSyncConnection: vi.fn(),
}));

const TOKEN = "hts_test_token_not_a_real_one";

const CREATED: SyncConnectionCreatedOut = {
  connection: {
    id: "c1",
    source: "apple_health",
    label: "Apple Health",
    created_at: "2026-04-20T08:00:00Z",
    last_used_at: null,
  },
  token: TOKEN,
};

/** `userEvent.setup()` installs its own clipboard stub on `navigator`; spying on that stub is
 * what lets a test both observe the write and make it fail. */
function setup() {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  const view = render(<AppleHealthConnect />);
  return { user, writeText, ...view };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("AppleHealthConnect steps", () => {
  it("renders every setup step, in order", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1, name: "Connect Apple Health" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Step 1 — Create a connection",
      "Step 2 — Install the Shortcut",
      "Step 3 — Add the token",
      "Step 4 — Create your automation",
      "Step 5 — Run it once",
      "How syncing works",
    ]);
  });

  it("makes clear the Shortcut, not the website, is what reads Apple Health", () => {
    setup();

    expect(screen.getByText(/HealthTrend cannot read Apple Health directly/)).toBeInTheDocument();
    expect(screen.getByText("reads Weight measurements only")).toBeInTheDocument();
    expect(screen.getByText("reads them from Apple Health, on your iPhone")).toBeInTheDocument();
    expect(screen.getByText("sends each weight and its timestamp to HealthTrend")).toBeInTheDocument();
    expect(screen.getByText("does not write anything back to Apple Health")).toBeInTheDocument();
  });

  it("explains the personal automation and the locked-phone limitation without overpromising", () => {
    setup();

    expect(screen.getByText(/A shared Shortcut does not include an automation/)).toBeInTheDocument();
    expect(screen.getByText("Create a new Time of Day automation.")).toBeInTheDocument();
    expect(screen.getByText("Select Run Immediately.")).toBeInTheDocument();
    expect(
      screen.getByText(/Apple may restrict Health data access while your iPhone has been locked/),
    ).toHaveTextContent("the next successful run will catch up");
    expect(screen.queryByText(/data loss|lost/i)).toBeNull();
  });

  it("links to History for the first-run check", () => {
    setup();

    expect(screen.getByRole("link", { name: "View History" })).toHaveAttribute(
      "href",
      "/app/measurements",
    );
  });

  it("explains that sync only adds readings", () => {
    setup();

    expect(screen.getByText(/Syncing currently only adds readings/)).toBeInTheDocument();
    expect(screen.getByText(/you may need to remove the HealthTrend copy yourself/)).toBeInTheDocument();
    expect(screen.getByText(/a later sync may add it again/)).toBeInTheDocument();
  });

  it("links Get HealthTrend Shortcut to the published iCloud Shortcut, and nowhere else external", () => {
    // Pins the production share link, so changing it is a deliberate edit in two places.
    expect(APPLE_HEALTH_SHORTCUT_URL).toBe(
      "https://www.icloud.com/shortcuts/4465aeec7f8143288db1cf6e5e249ecd",
    );

    setup();

    const shortcut = screen.getByRole("link", { name: "Get HealthTrend Shortcut" });
    expect(shortcut).toHaveAttribute("href", APPLE_HEALTH_SHORTCUT_URL);
    expect(shortcut).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: "Get HealthTrend Shortcut" })).toBeNull();
    expect(screen.queryByText("The Shortcut link is not available yet.")).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      if (link !== shortcut) {
        expect(link.getAttribute("href")).toMatch(/^\/app\//);
      }
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = setup();
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});

describe("AppleHealthConnect token", () => {
  it("shows no token and creates nothing until asked", () => {
    const { container } = setup();

    expect(createSyncConnection).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/hts_/);
    expect(screen.queryByLabelText("Connection token")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy token" })).toBeNull();
  });

  it("creates an Apple Health connection and shows its token once, with the warning", async () => {
    vi.mocked(createSyncConnection).mockResolvedValue(CREATED);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Create connection" }));

    expect(await screen.findByLabelText("Connection token")).toHaveValue(TOKEN);
    expect(createSyncConnection).toHaveBeenCalledTimes(1);
    expect(createSyncConnection).toHaveBeenCalledWith("Apple Health");
    expect(screen.getByText(/This token is shown only once/)).toHaveTextContent(
      "You’ll add it to the HealthTrend Shortcut in the next step.",
    );
    // One connection per visit: the create button is gone once a token exists.
    expect(screen.queryByRole("button", { name: "Create connection" })).toBeNull();
  });

  it("copies the token to the clipboard and confirms it", async () => {
    vi.mocked(createSyncConnection).mockResolvedValue(CREATED);
    const { user, writeText } = setup();

    await user.click(screen.getByRole("button", { name: "Create connection" }));
    await user.click(await screen.findByRole("button", { name: "Copy token" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByRole("status")).toHaveTextContent("Token copied.");
  });

  it("says so when the clipboard refuses, leaving the token selectable", async () => {
    vi.mocked(createSyncConnection).mockResolvedValue(CREATED);
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await user.click(screen.getByRole("button", { name: "Create connection" }));
    await user.click(await screen.findByRole("button", { name: "Copy token" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy automatically.");
    expect(screen.getByLabelText("Connection token")).toHaveValue(TOKEN);
  });

  it("keeps the token out of the URL, history and the console", async () => {
    vi.mocked(createSyncConnection).mockResolvedValue(CREATED);
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Create connection" }));
    await screen.findByLabelText("Connection token");

    expect(window.location.href).not.toContain(TOKEN);
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain(TOKEN);
    }
  });

  it("shows the backend's message when the connection cap is reached", async () => {
    vi.mocked(createSyncConnection).mockRejectedValue(
      new ApiError(422, {
        code: "sync_connection_limit_exceeded",
        message: "This account already holds the maximum of 5 sync connections.",
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Create connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account already holds the maximum of 5 sync connections.",
    );
    expect(screen.queryByLabelText("Connection token")).toBeNull();
    expect(screen.getByRole("button", { name: "Create connection" })).toBeEnabled();
  });

  it("stays usable when the backend cannot be reached", async () => {
    vi.mocked(createSyncConnection).mockRejectedValue(new NetworkError(new TypeError("offline")));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Create connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the analysis service.",
    );
    expect(screen.getByRole("button", { name: "Create connection" })).toBeEnabled();
  });
});
