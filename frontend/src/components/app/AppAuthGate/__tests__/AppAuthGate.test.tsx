import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import type { MeOut } from "@/lib/api/types";
import { AppAuthGate } from "../AppAuthGate";

/**
 * The auth boundary's four states. `useAccount` and `next/navigation` are mocked directly
 * rather than wrapped in a real `AccountProvider` -- this component's whole job is to react to
 * an `AccountStatus` it is handed, and `AccountProvider.test.tsx` already covers where that
 * status comes from.
 */

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => "/app"),
}));

const ME: MeOut = {
  user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
  preferences: { display_unit: "kg" },
  goal: null,
  measurement_count: 3,
};

function mockAccount(overrides: Partial<ReturnType<typeof useAccount>>) {
  vi.mocked(useAccount).mockReturnValue({
    status: "loading",
    account: null,
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

describe("AppAuthGate", () => {
  it("renders the protected content and shell once authenticated", () => {
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockAccount({ status: "authenticated", account: ME });

    render(
      <AppAuthGate>
        <p>Dashboard content</p>
      </AppAuthGate>,
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("redirects to /app/sign-in when unauthenticated, without rendering protected content", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockAccount({ status: "unauthenticated" });

    render(
      <AppAuthGate>
        <p>Dashboard content</p>
      </AppAuthGate>,
    );

    expect(replace).toHaveBeenCalledWith("/app/sign-in");
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("shows a checking state while loading, without redirecting", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockAccount({ status: "loading" });

    render(
      <AppAuthGate>
        <p>Dashboard content</p>
      </AppAuthGate>,
    );

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("shows a recoverable error state on a network/server failure, not a sign-out redirect", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockAccount({ status: "error", errorMessage: "Could not reach the analysis service." });

    render(
      <AppAuthGate>
        <p>Dashboard content</p>
      </AppAuthGate>,
    );

    expect(screen.getByText("HealthTrend is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Could not reach the analysis service.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("retrying the error state calls refresh()", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    const refresh = vi.fn();
    mockAccount({ status: "error", errorMessage: "Offline.", refresh });

    render(
      <AppAuthGate>
        <p>Dashboard content</p>
      </AppAuthGate>,
    );
    screen.getByRole("button", { name: "Try again" }).click();

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
