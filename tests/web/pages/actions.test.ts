// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { handleAddExpense, handleAddIncoming, handleAddRecurring, handleDeleteExpense, handleDeleteIncoming, handleDeleteRecurring, handleStartEditExpense, handleStartEditIncoming, handleStartEditRecurring, handleUpdateExpense, handleUpdateIncoming, handleUpdateRecurring, saveOption } from "../../../Codebase - Pensive Web/src/pages/actions";
import type { EditValues } from "../../../Codebase - Pensive Web/src/types/workspace";

function formWith(values: Record<string, string>) {
  const form = document.createElement("form");
  for (const [name, value] of Object.entries(values)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return form;
}

function submitEvent(form: HTMLFormElement) {
  return {
    currentTarget: form,
    preventDefault: vi.fn(),
  } as never;
}

const baseDeps = () => ({
  setSaving: vi.fn(),
  setFormType: vi.fn(),
  onSelectTab: vi.fn(),
});

describe("web page actions", () => {
  it("trims and ignores empty option creation", async () => {
    const addUserOption = vi.fn().mockResolvedValue(undefined);
    await saveOption(addUserOption, "subcategory", "  Dinner  ", "  Food  ");
    await saveOption(addUserOption, "category", "   ");
    expect(addUserOption).toHaveBeenCalledOnce();
    expect(addUserOption).toHaveBeenCalledWith({
      kind: "subcategory",
      value: "Dinner",
      parentValue: "Food",
    });
  });

  it("creates a manual expense, persists options, resets the form, and navigates", async () => {
    const form = formWith({
      monthYears: '["2025-01"]',
      date: "2025-01-05",
      effectiveAmountMode: "manual",
      effectiveAmount: "40.50",
      expense: "Lunch",
      account: " Checking ",
      category: "Food",
      subcategory: "Restaurant",
      amount: "100",
      paidTo: "Cafe",
      notes: "note",
      comments: "comment",
    });
    const createExpense = vi.fn().mockResolvedValue("expense-id");
    const addUserOption = vi.fn().mockResolvedValue(undefined);
    const deps = { ...baseDeps(), createExpense, addUserOption };

    const result = await handleAddExpense(submitEvent(form), deps);
    expect(result).toBe("expense-id");
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        effectiveAmount: 40.5,
        effectiveAmountMode: "manual",
        monthYears: ["2025-01"],
        expenseId: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
      }),
    );
    expect(addUserOption).toHaveBeenCalledTimes(3);
    expect(deps.setSaving).toHaveBeenNthCalledWith(1, true);
    expect(deps.setSaving).toHaveBeenLastCalledWith(false);
    expect(deps.setFormType).toHaveBeenCalledWith(null);
    expect(deps.onSelectTab).toHaveBeenCalledWith("expenses");
    expect((form.elements.namedItem("expense") as HTMLInputElement).value).toBe(
      "",
    );
    form.remove();
  });

  it("does not create when the month selection is empty and always clears saving after an error", async () => {
    const emptyForm = formWith({ monthYears: "[]" });
    const deps = {
      ...baseDeps(),
      createExpense: vi.fn(),
      addUserOption: vi.fn(),
    };
    await expect(
      handleAddExpense(submitEvent(emptyForm), deps),
    ).resolves.toBeNull();
    expect(deps.createExpense).not.toHaveBeenCalled();
    expect(deps.setSaving).not.toHaveBeenCalled();
    emptyForm.remove();

    const failingForm = formWith({ monthYears: '["2025-01"]', amount: "10" });
    const failure = new Error("create failed");
    const failingDeps = {
      ...baseDeps(),
      createExpense: vi.fn().mockRejectedValue(failure),
      addUserOption: vi.fn(),
    };
    await expect(
      handleAddExpense(submitEvent(failingForm), failingDeps),
    ).rejects.toThrow("create failed");
    expect(failingDeps.setSaving).toHaveBeenLastCalledWith(false);
    failingForm.remove();
  });

  it("creates incoming rows with auto effective amounts and creates their option values", async () => {
    const form = formWith({
      monthYears: '["2025-02"]',
      date: "2025-02-05",
      effectiveAmountMode: "auto",
      incoming: "Salary",
      paidBy: "Employer",
      incomeType: "Work",
      incomeSubtype: "Salary",
      account: "Checking",
      amount: "200",
    });
    const createIncoming = vi.fn().mockResolvedValue("incoming-id");
    const addUserOption = vi.fn().mockResolvedValue(undefined);
    const deps = { ...baseDeps(), createIncoming, addUserOption };
    await expect(handleAddIncoming(submitEvent(form), deps)).resolves.toBe(
      "incoming-id",
    );
    expect(createIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 200,
        effectiveAmount: undefined,
        effectiveAmountMode: "auto",
      }),
    );
    expect(addUserOption).toHaveBeenCalledWith({
      kind: "incomeType",
      value: "Work",
      parentValue: undefined,
    });
    expect(addUserOption).toHaveBeenCalledWith({
      kind: "account",
      value: "Checking",
      parentValue: undefined,
    });
    expect(addUserOption).toHaveBeenCalledWith({
      kind: "incomeSubtype",
      value: "Salary",
      parentValue: "Work",
    });
    expect(deps.onSelectTab).toHaveBeenCalledWith("incomings");
    form.remove();
  });

  it("honors the recurring day confirmation and only sends fields for the selected kind", async () => {
    const form = formWith({
      kind: "expense",
      dayOfMonth: "31",
      name: "Rent",
      amount: "50",
      recurringExpenseAccount: "Checking",
      recurringExpenseCategory: "Housing",
      recurringExpenseSubcategory: "Rent",
      recurringExpensePaidTo: "Landlord",
      recurringIncomingPaidBy: "should-not-send",
    });
    const createRecurring = vi.fn().mockResolvedValue("recurring-id");
    const deps = { ...baseDeps(), createRecurring };
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await expect(
      handleAddRecurring(submitEvent(form), deps),
    ).resolves.toBeUndefined();
    expect(createRecurring).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await handleAddRecurring(submitEvent(form), deps);
    expect(createRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "expense",
        frequency: "Monthly",
        dayOfMonth: 31,
        recurringExpenseAccount: "Checking",
        recurringIncomingPaidBy: undefined,
      }),
    );
    expect(deps.onSelectTab).toHaveBeenCalledWith("recurrings");
    form.remove();
    vi.restoreAllMocks();
  });

  it("maps rows into edit state and sends normalized update/delete mutations", async () => {
    const setExpenseId = vi.fn();
    const setIncomingId = vi.fn();
    const setRecurringId = vi.fn();
    const setEditValues = vi.fn();
    const expense = {
      _id: "expense-doc",
      expense: "Lunch",
      account: "Checking",
      category: "Food",
      subcategory: undefined,
      amount: 100,
      effectiveAmount: 80,
      effectiveAmountMode: "manual",
      date: "2025-01-05",
      monthYears: ["2025-01"],
      paidTo: "Cafe",
      expenseId: "expense-id",
    } as Parameters<typeof handleStartEditExpense>[0];
    const incoming = {
      _id: "incoming-doc",
      incoming: "Salary",
      paidBy: "Employer",
      incomeType: "Work",
      account: "Checking",
      amount: 200,
      date: "2025-01-05",
      monthYears: ["2025-01"],
      incomingId: "incoming-id",
    } as Parameters<typeof handleStartEditIncoming>[0];
    const recurring = {
      _id: "recurring-doc",
      status: "active",
      kind: "expense",
      name: "Rent",
      amount: 50,
      frequency: "Monthly",
      dayOfMonth: 15,
    } as Parameters<typeof handleStartEditRecurring>[0];
    handleStartEditExpense(expense, setExpenseId, setEditValues);
    handleStartEditIncoming(incoming, setIncomingId, setEditValues);
    handleStartEditRecurring(recurring, setRecurringId, setEditValues);
    expect(setExpenseId).toHaveBeenCalledWith("expense-doc");
    expect(setIncomingId).toHaveBeenCalledWith("incoming-doc");
    expect(setRecurringId).toHaveBeenCalledWith("recurring-doc");
    expect(setEditValues).toHaveBeenCalledTimes(3);

    const updateExpense = vi.fn().mockResolvedValue(undefined);
    const expenseState: EditValues = {
      expense: "Lunch",
      account: "Checking",
      category: "Food",
      amount: "100",
      effectiveAmount: "80",
      effectiveAmountMode: "manual",
      monthYears: '["2025-01"]',
      date: "2025-01-05",
      paidTo: "Cafe",
      expenseId: "expense-id",
    };
    const updateExpenseDeps = {
      updateExpense,
      editValues: expenseState,
      setSaving: vi.fn(),
      setEditingExpenseId: vi.fn(),
    };
    await handleUpdateExpense(expense, updateExpenseDeps);
    expect(updateExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveAmount: 80,
        effectiveAmountMode: "manual",
      }),
    );
    expect(updateExpenseDeps.setEditingExpenseId).toHaveBeenCalledWith(null);

    const updateIncoming = vi.fn().mockResolvedValue(undefined);
    const incomingState: EditValues = {
      ...expenseState,
      incoming: "Salary",
      paidBy: "Employer",
      incomeType: "Work",
      account: "Checking",
      incomingId: "incoming-id",
    };
    const updateIncomingDeps = {
      updateIncoming,
      editValues: incomingState,
      setSaving: vi.fn(),
      setEditingIncomingId: vi.fn(),
    };
    await handleUpdateIncoming(incoming, updateIncomingDeps);
    expect(updateIncoming).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: "Salary",
        incomingId: "incoming-id",
      }),
    );

    const updateRecurring = vi.fn().mockResolvedValue(undefined);
    const recurringState = {
      status: "inactive",
      kind: "incoming",
      name: "Salary",
      amount: "200",
      dayOfMonth: "15",
      recurringIncomingPaidBy: "Employer",
      recurringIncomingType: "Work",
      recurringIncomingAccount: "Checking",
    } as never;
    const updateRecurringDeps = {
      updateRecurring,
      editValues: recurringState,
      setSaving: vi.fn(),
      setEditingRecurringId: vi.fn(),
    };
    await handleUpdateRecurring(
      { ...recurring, frequency: "Monthly" },
      updateRecurringDeps,
    );
    expect(updateRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "incoming",
        recurringIncomingType: "Work",
        recurringExpenseAccount: undefined,
      }),
    );

    const deleteExpense = vi.fn().mockResolvedValue(undefined);
    const deleteIncoming = vi.fn().mockResolvedValue(undefined);
    const deleteRecurring = vi.fn().mockResolvedValue(undefined);
    await handleDeleteExpense(expense, deleteExpense, vi.fn());
    await handleDeleteIncoming(incoming, deleteIncoming, vi.fn());
    await handleDeleteRecurring(recurring, deleteRecurring, vi.fn());
    expect(deleteExpense).toHaveBeenCalledWith({ id: "expense-doc" });
    expect(deleteIncoming).toHaveBeenCalledWith({ id: "incoming-doc" });
    expect(deleteRecurring).toHaveBeenCalledWith({ id: "recurring-doc" });
  });
});
