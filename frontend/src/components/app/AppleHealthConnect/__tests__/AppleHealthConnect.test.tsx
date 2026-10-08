import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { createSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { SyncConnectionCreatedOut } from "@/lib/api/types";
import {
  APPLE_HEALTH_HISTORY_SHORTCUT_URL,
  APPLE_HEALTH_SYNC_SHORTCUT_URL,
} from "@/lib/sync/appleHealthShortcut";
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
  it("renders the three setup steps, in order", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1, name: "Connect Apple Health" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Step 1 — Create a connection",
      "Step 2 — Import existing history",
      "Step 3 — Set up automatic sync",
      "How syncing works",
    ]);
  });

  it("makes clear the Shortcuts, not the website, are what read Apple Health", () => {
    setup();

    const intro = screen.getByText(/HealthTrend cannot read Apple Health directly/);
    expect(intro).toHaveTextContent("Apple Shortcuts on your iPhone");
    expect(intro).toHaveTextContent("They read Weight only");
    expect(intro).toHaveTextContent("never write anything back to Apple Health");
  });

  it("walks through the history import, with the token pasted into the Shortcut by hand", () => {
    setup();

    const step = screen.getByRole("heading", { name: "Step 2 — Import existing history" })
      .parentElement!;
    expect(within(step).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Add the 3-year history Shortcut.",
      "Open the Shortcut in the Shortcuts app.",
      "At the very top, find the Text action containing PASTE_TOKEN_HERE.",
      "Replace PASTE_TOKEN_HERE with your HealthTrend connection token.",
      "Run the Shortcut once.",
    ]);
    expect(within(step).getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/app/measurements",
    );
  });

  it("walks through automatic sync: same token, one test run, a daily automation", () => {
    setup();

    const step = screen.getByRole("heading", { name: "Step 3 — Set up automatic sync" })
      .parentElement!;
    expect(within(step).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Add the 14-day sync Shortcut.",
      "Open it and replace PASTE_TOKEN_HERE at the top with the same HealthTrend connection token.",
      "Run it once to confirm it works.",
      "In Shortcuts → Automation, create a daily Time of Day automation for this Shortcut and choose Run Immediately.",
    ]);
    expect(
      screen.getByText(/Apple may restrict Health data access while your iPhone has been locked/),
    ).toHaveTextContent("the next successful run will catch up");
    expect(screen.queryByText(/data loss|lost/i)).toBeNull();
  });

  it("never says a Shortcut will ask for the token", () => {
    const { container } = setup();

    expect(container.textContent).not.toMatch(/when it asks|asks for (your|the)|prompt/i);
  });

  it("explains that sync only adds readings", () => {
    setup();

    expect(screen.getByText(/Syncing currently only adds readings/)).toBeInTheDocument();
    expect(screen.getByText(/you may need to remove the HealthTrend copy yourself/)).toBeInTheDocument();
    expect(screen.getByText(/a later sync may add it again/)).toBeInTheDocument();
  });

  it("links each step to its own published iCloud Shortcut, and nowhere else external", () => {
    // Pins the production share links, so changing one is a deliberate edit in two places.
    expect(APPLE_HEALTH_HISTORY_SHORTCUT_URL).toBe(
      "https://www.icloud.com/shortcuts/72fa8474101b4691be9832211ec31a18",
    );
    expect(APPLE_HEALTH_SYNC_SHORTCUT_URL).toBe(
      "https://www.icloud.com/shortcuts/af93d96b4062489897131e345594eb98",
    );

    setup();

    const history = screen.getByRole("link", { name: "Get the history import Shortcut" });
    const sync = screen.getByRole("link", { name: "Get the automatic sync Shortcut" });
    expect(history).toHaveAttribute("href", APPLE_HEALTH_HISTORY_SHORTCUT_URL);
    expect(sync).toHaveAttribute("href", APPLE_HEALTH_SYNC_SHORTCUT_URL);
    for (const shortcut of [history, sync]) {
      expect(shortcut).toHaveAttribute("rel", "noopener noreferrer");
    }
    for (const link of screen.getAllByRole("link")) {
      if (link !== history && link !== sync) {
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
      "You’ll use the same token in both Shortcuts.",
    );
    expect(screen.getByText(/Keep this token private\./)).toHaveTextContent(
      "Keep this token private. Anyone with it can sync weight readings to your HealthTrend account. You can revoke it at any time in Settings.",
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
