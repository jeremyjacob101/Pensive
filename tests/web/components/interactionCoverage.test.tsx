// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LeftMenuPanel } from "../../../Codebase - Pensive Web/src/components/LeftMenuPanel";
import { MonthYearMultiSelect } from "../../../Codebase - Pensive Web/src/components/MonthYearMultiSelect";
import { MultiSelectFilterDropdown } from "../../../Codebase - Pensive Web/src/components/MultiSelectFilterDropdown";
import { ScopeCalendarButton } from "../../../Codebase - Pensive Web/src/components/ScopeCalendarButton";
import { layoutMenuItems, type MenuItemKey } from "../../../Codebase - Pensive Web/src/types/ui";

function StatefulMonthPicker({ initialValue = [] as string[] }: {
  initialValue?: string[];
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <MonthYearMultiSelect
      value={value}
      onChange={setValue}
      required
      defaultExpanded
    />
  );
}

function StatefulFilter({ initialValue = [] as string[] }: {
  initialValue?: string[];
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <MultiSelectFilterDropdown
      label="Categories"
      options={[
        { value: "food", label: "Food", color: "#ef4444" },
        { value: "housing", label: "Housing" },
      ]}
      selected={value}
      onChange={setValue}
    />
  );
}

describe("web component interaction coverage", () => {
  it("navigates between menu items, toggles the theme, and signs out", () => {
    const onSelect = vi.fn<(item: MenuItemKey) => void>();
    const onUserClick = vi.fn();
    const onToggleTheme = vi.fn();

    render(
      <LeftMenuPanel
        items={layoutMenuItems}
        activeItem="expenses"
        onSelect={onSelect}
        onUserClick={onUserClick}
        isDark={false}
        onToggleTheme={onToggleTheme}
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expenses" })).toHaveClass(
      "active",
    );
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(onSelect).toHaveBeenCalledWith("options");
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(onUserClick).toHaveBeenCalledOnce();
  });

  it("selects, removes, clears, and keyboard-navigates months", async () => {
    render(<StatefulMonthPicker initialValue={["2025-01"]} />);

    const january = screen.getByRole("gridcell", {
      name: /January 2025, selected/,
    });
    const february = screen.getByRole("gridcell", {
      name: /February 2025, not selected/,
    });
    expect(january).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(february);
    expect(
      screen.getByRole("gridcell", { name: /February 2025, selected/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".month-picker-summary")).toHaveTextContent(
      "Jan – Feb 2025",
    );

    fireEvent.click(
      screen.getByRole("gridcell", { name: /January 2025, selected/ }),
    );
    expect(
      screen.getByRole("gridcell", { name: /January 2025, not selected/ }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(
      screen.getByRole("gridcell", { name: /February 2025, selected/ }),
      { key: "ArrowRight" },
    );
    await waitFor(() =>
      expect(
        screen.getByRole("gridcell", { name: /March 2025/ }),
      ).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select at least one month.",
    );
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("changes the visible picker year and includes an interior month without changing endpoints", () => {
    render(<StatefulMonthPicker initialValue={["2025-01", "2025-03"]} />);

    fireEvent.click(
      screen.getByRole("gridcell", { name: /February 2025, not selected/ }),
    );
    expect(
      screen.getByRole("gridcell", { name: /February 2025, selected/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show 2026" }));
    expect(
      screen.getByText("2026", { selector: ".month-picker-year" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 2025" }));
    expect(
      screen.getByRole("gridcell", { name: /January 2025, selected/ }),
    ).toBeInTheDocument();
  });

  it("supports filter selection, select-all, deselect-all, color metadata, and outside closing", () => {
    render(<StatefulFilter initialValue={["food"]} />);

    fireEvent.click(screen.getByRole("button", { name: /Categories/ }));
    expect(screen.getByText("Filtered")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Food" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Housing" })).not.toBeChecked();
    expect(screen.getByText("Food").previousElementSibling).toHaveStyle({
      backgroundColor: "rgb(239, 68, 68)",
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Housing" }));
    expect(screen.getByRole("checkbox", { name: "Housing" })).toBeChecked();
    expect(screen.queryByText("Filtered")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(screen.getByRole("checkbox", { name: "Food" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Food" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Housing" })).toBeChecked();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Deselect all")).not.toBeInTheDocument();
  });

  it("applies a bounded month scope and closes when the user clicks outside", () => {
    const onApplyMonths = vi.fn();
    const view = render(
      <ScopeCalendarButton
        mode="month"
        targetMonths={["2025-02"]}
        startDate="2025-02-01"
        endDate="2025-02-28"
        monthBounds={{ oldestMonth: "2025-01", newestMonth: "2025-03" }}
        onApplyMonths={onApplyMonths}
        onApplyCustom={vi.fn()}
      />,
    );

    const panel = view.container.querySelector(".scope-simple-wrap");
    expect(panel).not.toHaveClass("is-open");
    fireEvent.click(screen.getByRole("button", { name: "Scope selector" }));
    expect(panel).toHaveClass("is-open");

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "2025-01" } });
    fireEvent.change(selects[1], { target: { value: "2025-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApplyMonths).toHaveBeenCalledWith([
      "2025-01",
      "2025-02",
      "2025-03",
    ]);
    expect(panel).not.toHaveClass("is-open");

    fireEvent.click(screen.getByRole("button", { name: "Scope selector" }));
    fireEvent.mouseDown(document.body);
    expect(panel).not.toHaveClass("is-open");
  });

  it("applies custom dates and disables invalid inverted ranges", () => {
    const onApplyCustom = vi.fn();
    render(
      <ScopeCalendarButton
        mode="custom"
        targetMonths={[]}
        startDate="2025-02-01"
        endDate="2025-02-28"
        onApplyMonths={vi.fn()}
        onApplyCustom={onApplyCustom}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scope selector" }));
    const startDate = screen.getByLabelText("Start Date");
    const endDate = screen.getByLabelText("End Date");
    fireEvent.change(startDate, { target: { value: "2025-03-01" } });
    fireEvent.change(endDate, { target: { value: "2025-03-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApplyCustom).toHaveBeenCalledWith("2025-03-01", "2025-03-31");

    fireEvent.click(screen.getByRole("button", { name: "Scope selector" }));
    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "2025-04-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date"), {
      target: { value: "2025-03-31" },
    });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(onApplyCustom).toHaveBeenCalledOnce();
  });
});
