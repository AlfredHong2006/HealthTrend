import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { requestSignInCode, verifySignInCode } from "@/lib/api/accountClient";
import { ApiError, UnauthorizedError } from "@/lib/api/errors";
import type { MeOut } from "@/lib/api/types";
import { SignInForm } from "../SignInForm";

vi.mock("@/lib/api/accountClient", () => ({
  requestSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
}));

vi.mock("@/components/app/AccountProvider/AccountProvider", () => ({
  useAccount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

const ME: MeOut = {
  user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
  preferences: { display_unit: "kg" },
  goal: null,
  measurement_count: 0,
};

function setup() {
  const replace = vi.fn();
  const signedIn = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  vi.mocked(useAccount).mockReturnValue({
    status: "unauthenticated",
    account: null,
    errorMessage: null,
    refresh: vi.fn(),
    signedIn,
    logout: vi.fn(),
    dataVersion: 0,
    notifyMeasurementsChanged: vi.fn(),
    reloadAccount: vi.fn(),
    deleteAccount: vi.fn(),
  });
  const user = userEvent.setup();
  const { container } = render(<SignInForm />);
  return { user, replace, signedIn, container };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("SignInForm", () => {
  it("requests a code for a normalised email and moves to the code step", async () => {
    vi.mocked(requestSignInCode).mockResolvedValue(undefined);
    const { user } = setup();

    await user.type(screen.getByLabelText("Email address"), "  Reader@Example.com  ");
    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));

    await waitFor(() => expect(requestSignInCode).toHaveBeenCalledWith("reader@example.com"));
    expect(screen.getByLabelText("Sign-in code")).toBeInTheDocument();
    expect(screen.getByText(/reader@example\.com/)).toBeInTheDocument();
  });

  it("shows the sanitised error message when the code request is rejected", async () => {
    vi.mocked(requestSignInCode).mockRejectedValue(
      new ApiError(422, { code: "email_invalid", message: "That address is not valid." }),
    );
    const { user } = setup();

    await user.type(screen.getByLabelText("Email address"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That address is not valid."),
    );
    expect(screen.queryByLabelText("Sign-in code")).not.toBeInTheDocument();
  });

  it("verifies the code, records the account and routes to /app on success", async () => {
    vi.mocked(requestSignInCode).mockResolvedValue(undefined);
    vi.mocked(verifySignInCode).mockResolvedValue(ME);
    const { user, replace, signedIn } = setup();

    await user.type(screen.getByLabelText("Email address"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));
    await user.type(await screen.findByLabelText("Sign-in code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(verifySignInCode).toHaveBeenCalledWith("reader@example.com", "123456"));
    expect(signedIn).toHaveBeenCalledWith(ME);
    expect(replace).toHaveBeenCalledWith("/app");
  });

  it("shows an error and stays on the code step when verification fails", async () => {
    vi.mocked(requestSignInCode).mockResolvedValue(undefined);
    vi.mocked(verifySignInCode).mockRejectedValue(
      new UnauthorizedError({ code: "code_invalid", message: "That code is invalid or has expired." }),
    );
    const { user, replace, signedIn } = setup();

    await user.type(screen.getByLabelText("Email address"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));
    await user.type(await screen.findByLabelText("Sign-in code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That code is invalid or has expired."),
    );
    expect(signedIn).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Sign-in code")).toBeInTheDocument();
  });

  it("'send a new code' returns to the email step and requests again for the same address", async () => {
    vi.mocked(requestSignInCode).mockResolvedValue(undefined);
    const { user } = setup();

    await user.type(screen.getByLabelText("Email address"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));
    await user.click(
      await screen.findByRole("button", { name: "Use a different email or send a new code" }),
    );

    const emailInput = screen.getByLabelText<HTMLInputElement>("Email address");
    expect(emailInput.value).toBe("reader@example.com");

    await user.click(screen.getByRole("button", { name: "Send sign-in code" }));

    expect(requestSignInCode).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Sign-in code")).toBeInTheDocument();
    // No invented countdown -- resubmitting is immediately available again.
    expect(screen.queryByText(/resend in|wait \d+ seconds/i)).not.toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = setup();
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
