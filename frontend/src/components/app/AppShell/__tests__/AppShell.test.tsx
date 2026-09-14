import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import type { MeOut } from "@/lib/api/types";
import { AppShell } from "../AppShell";

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

const ME: MeOut = {
  user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
  preferences: { display_unit: "kg" },
  goal: null,
  measurement_count: 3,
};

function mockUseAccount(overrides: Partial<ReturnType<typeof useAccount>> = {}) {
  vi.mocked(useAccount).mockReturnValue({
    status: "authenticated",
    account: ME,
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
    ...overrides,
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AppShell", () => {
  it("shows every real destination, including Import and Settings, and nothing else", () => {
    vi.mocked(usePathname).mockReturnValue("/app");
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUseAccount();

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "HealthTrend" });
    expect(within(nav).getByRole("link", { name: "Trend" })).toHaveAttribute("href", "/app");
    expect(within(nav).getByRole("link", { name: "Log" })).toHaveAttribute("href", "/app/log");
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/app/measurements",
    );
    expect(within(nav).getByRole("link", { name: "Import" })).toHaveAttribute(
      "href",
      "/app/import",
    );
    expect(within(nav).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/app/settings",
    );
    expect(within(nav).getByRole("link", { name: "Method" })).toHaveAttribute(
      "href",
      "/v2/method",
    );
    expect(within(nav).getByRole("link", { name: "Demo" })).toHaveAttribute(
      "href",
      "/v2/gradual-loss",
    );
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    for (const dead of ["Goals", "Coaching", "Devices"]) {
      expect(within(nav).queryByRole("link", { name: dead })).not.toBeInTheDocument();
    }
  });

  it("every nav destination is a route that exists in this app", async () => {
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    vi.mocked(usePathname).mockReturnValue("/app");
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUseAccount();

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const appDir = path.resolve(import.meta.dirname, "../../../../app");
    const nav = screen.getByRole("navigation", { name: "HealthTrend" });
    for (const link of within(nav).getAllByRole("link")) {
      const href = link.getAttribute("href")!;
      // /v2/gradual-loss is served by the dynamic [scenario] route, not a literal directory.
      const routePath = href.startsWith("/v2/gradual-loss")
        ? "/v2/[scenario]"
        : href;
      expect(existsSync(path.join(appDir, routePath, "page.tsx")), href).toBe(true);
    }
  });

  it("the Demo link resolves to the canonical public synthetic Analysis route", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    vi.mocked(usePathname).mockReturnValue("/app");
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUseAccount();

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "HealthTrend" });
    const demoHref = within(nav).getByRole("link", { name: "Demo" }).getAttribute("href")!;

    // The canonical public entry point is documented in V2_PRODUCT.md as /v2/gradual-loss,
    // and /v2 itself redirects there -- assert the Demo link matches that documented default,
    // rather than duplicating any analysis rendering.
    const v2IndexSource = readFileSync(
      path.resolve(import.meta.dirname, "../../../../app/v2/page.tsx"),
      "utf-8",
    );
    expect(v2IndexSource).toContain(demoHref);
  });

  it("marks the current destination with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/app/measurements");
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUseAccount();

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "HealthTrend" });
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Trend" })).not.toHaveAttribute("aria-current");
  });

  it("signs out, calling logout() and routing to /app/sign-in", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    vi.mocked(usePathname).mockReturnValue("/app");
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAccount({ logout });

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/app/sign-in");
  });

  it("shows a recoverable message, without navigating, when signing out fails", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    vi.mocked(usePathname).mockReturnValue("/app");
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    const logout = vi.fn().mockRejectedValue(new Error("offline"));
    mockUseAccount({ logout });

    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not sign out just now."),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
