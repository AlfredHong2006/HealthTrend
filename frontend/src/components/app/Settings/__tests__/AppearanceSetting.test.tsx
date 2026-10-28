import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { chooseTheme } from "@/lib/theme/theme";
import { AppearanceSetting } from "../AppearanceSetting";

afterEach(() => {
  chooseTheme("light");
  document.documentElement.removeAttribute("data-theme");
});

describe("AppearanceSetting", () => {
  it("offers Light and Dark, with Light selected by default", () => {
    render(<AppearanceSetting />);

    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("switches the whole page to dark, and back", async () => {
    const user = userEvent.setup();
    render(<AppearanceSetting />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Light" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("shows the theme already in effect when the page opens", () => {
    chooseTheme("dark");

    render(<AppearanceSetting />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("says plainly that the choice stays in this browser and is not account data", () => {
    render(<AppearanceSetting />);

    expect(screen.getByText(/remembered in this browser only/)).toHaveTextContent(
      "It is not part of your account",
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<AppearanceSetting />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
