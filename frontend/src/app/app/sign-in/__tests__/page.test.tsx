import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import AppSignInPage from "../page";

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

function mockStatus(status: "loading" | "authenticated" | "unauthenticated" | "error") {
  vi.mocked(useAccount).mockReturnValue({
    status,
    account: null,
    errorMessage: null,
    refresh: vi.fn(),
    signedIn: vi.fn(),
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AppSignInPage", () => {
  it("shows the sign-in form while unauthenticated, and does not redirect (no loop with AppAuthGate)", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockStatus("unauthenticated");

    render(<AppSignInPage />);

    expect(screen.getByRole("heading", { name: "Sign in to HealthTrend" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an already-authenticated visitor to /app, without rendering the form", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockStatus("authenticated");

    render(<AppSignInPage />);

    expect(replace).toHaveBeenCalledWith("/app");
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  });

  it("does not redirect while the initial session check is still loading", () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockStatus("loading");

    render(<AppSignInPage />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);
    mockStatus("unauthenticated");

    const { container } = render(<AppSignInPage />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
