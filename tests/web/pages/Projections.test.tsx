// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Projections } from "../../../Codebase - Pensive Web/src/pages/Projections";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

describe("Projections page", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/projections?preview=1");
  });

  it("renders the preview fixture and updates bank selection", async () => {
    const user = userEvent.setup();
    render(<Projections />);

    expect(
      screen.getByRole("heading", { name: "Projections" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Everyday").length).toBeGreaterThan(0);
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
    expect(screen.getByText("Projected · 20Y")).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Hide Everyday on chart" })[0],
    );
    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Everyday on chart" }),
    ).toBeInTheDocument();
  });
});
