// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Savings } from "../../../Codebase - Pensive Web/src/pages/Savings";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

describe("Savings page", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/savings?preview=1");
  });

  it("renders the preview fixture and updates bank selection", async () => {
    const user = userEvent.setup();
    render(<Savings />);

    expect(
      screen.getByRole("heading", { name: "Savings" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Everyday").length).toBeGreaterThan(0);
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
    expect(screen.getByText("Forecast · 20Y")).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Hide Everyday on chart" })[0],
    );
    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Everyday on chart" }),
    ).toBeInTheDocument();
  });
});
