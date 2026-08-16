// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryModal, FormField, ModalActions } from "../../../Codebase - Pensive Web/src/components/EntryModal";
import { EditableRowActions } from "../../../Codebase - Pensive Web/src/components/EditableRowActions";
import { EffectiveAmountControls } from "../../../Codebase - Pensive Web/src/components/EffectiveAmountControls";
import { MonthNavigator } from "../../../Codebase - Pensive Web/src/components/MonthNavigator";
import { OptionPicker } from "../../../Codebase - Pensive Web/src/components/OptionPicker";
import { SearchFieldDropdown } from "../../../Codebase - Pensive Web/src/components/SearchFieldDropdown";
import { ThemeToggle } from "../../../Codebase - Pensive Web/src/components/ThemeToggle";

describe("web presentational components", () => {
  it("selects options and creates a new option from a prompt", async () => {
    const onChange = vi.fn();
    const onCreateOption = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "prompt").mockReturnValue("  New category  ");
    render(
      <OptionPicker
        kind="category"
        label="Category"
        name="category"
        value=""
        options={["Food", "Housing"]}
        placeholder="Choose category"
        required
        onChange={onChange}
        onCreateOption={onCreateOption}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Category" });
    fireEvent.change(select, { target: { value: "Food" } });
    expect(onChange).toHaveBeenCalledWith("Food");
    fireEvent.change(select, { target: { value: "__create_new_option__" } });
    await vi.waitFor(() =>
      expect(onCreateOption).toHaveBeenCalledWith(
        "category",
        "New category",
        undefined,
      ));
    expect(onChange).toHaveBeenLastCalledWith("New category");
    vi.restoreAllMocks();
  });

  it("keeps the current value when creating an option is cancelled", () => {
    const onChange = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(
      <OptionPicker
        kind="account"
        label="Account"
        value="Legacy"
        options={["Checking"]}
        placeholder="Choose account"
        onChange={onChange}
        onCreateOption={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Account" }), {
      target: { value: "__create_new_option__" },
    });
    expect(onChange).toHaveBeenCalledWith("Legacy");
    vi.restoreAllMocks();
  });

  it("renders month labels and wires navigation while honoring disabled boundaries", () => {
    const handlers = {
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onJumpToOldest: vi.fn(),
      onJumpToNewest: vi.fn(),
    };
    render(
      <MonthNavigator
        activeMonth="2025-01"
        mode="month"
        customRangeLabel="Custom range"
        targetMonths={["2025-02", "2025-01"]}
        canGoPrevious
        canGoNext={false}
        canJumpToOldest={false}
        canJumpToNewest
        {...handlers}
      />,
    );
    expect(screen.getByText("Jan '25 – Feb '25")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Jump to newest month" }),
    );
    expect(handlers.onPrevious).toHaveBeenCalledOnce();
    expect(handlers.onJumpToNewest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Jump to oldest month" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    render(
      <MonthNavigator
        activeMonth="2025-01"
        mode="custom"
        customRangeLabel="Jan 1 – Feb 28"
        canGoPrevious={false}
        canGoNext={false}
        canJumpToOldest={false}
        canJumpToNewest={false}
        {...handlers}
      />,
    );
    expect(screen.getByText("Jan 1 – Feb 28")).toBeInTheDocument();
  });

  it("switches effective amount mode when edited or reset to auto", () => {
    const onChange = vi.fn();
    const onModeChange = vi.fn();
    render(
      <EffectiveAmountControls
        value="80"
        mode="auto"
        inputName="effectiveAmount"
        modeName="effectiveAmountMode"
        onChange={onChange}
        onModeChange={onModeChange}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "75" } });
    expect(onChange).toHaveBeenCalledWith("75");
    expect(onModeChange).toHaveBeenCalledWith("manual");
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(onModeChange).toHaveBeenLastCalledWith("auto");
    expect(screen.getByDisplayValue("auto")).toHaveAttribute(
      "name",
      "effectiveAmountMode",
    );
  });

  it("closes modals only from the close action or overlay and renders field actions", () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const onPrimary = vi.fn();
    render(
      <EntryModal
        title="Add expense"
        subtitle="Details"
        onClose={onClose}
        footer={
          <ModalActions
            onCancel={onCancel}
            primaryLabel="Save"
            onPrimary={onPrimary}
          />
        }
      >
        <FormField label="Name" hint="Required">
          <input aria-label="Name" />
        </FormField>
      </EntryModal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Add expense" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onPrimary).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close Add expense" }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("confirms destructive row actions and disables saves while pending", () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender } = render(
      <EditableRowActions
        isEditing={false}
        saving={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
    rerender(
      <EditableRowActions
        isEditing
        saving
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    vi.restoreAllMocks();
  });

  it("filters search fields and closes the menu on outside pointer events", () => {
    const onChange = vi.fn();
    render(
      <SearchFieldDropdown
        options={[
          { value: "name", label: "Name" },
          { value: "notes", label: "Notes" },
        ]}
        selected={["name"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Search in/ }));
    expect(screen.getByText("Filtered")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Notes"));
    expect(onChange).toHaveBeenCalledWith(["name", "notes"]);
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Filtered")).not.toBeInTheDocument();
  });

  it("toggles the theme label and exposes the environment banner only for non-production URLs", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ThemeToggle isDark={false} onToggle={onToggle} />,
    );
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toHaveTextContent("Dark Mode");
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ThemeToggle isDark onToggle={onToggle} />);
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toHaveTextContent("Light Mode");
    expect(
      screen.queryByRole("status", { name: /Application environment/ }),
    ).not.toBeInTheDocument();
  });
});
