import { buildEmptySplitExpenseDraft, buildEmptySplitIncomingDraft } from "../helpers/splitDrafts";
import type { SplitExpenseDraft, SplitIncomingDraft } from "../types/splitDrafts";
import { getDefaultOptionValue, toOptionValues } from "../helpers/options";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormType, UserOptions } from "../types/workspace";
import { randomId16, toAmount } from "../helpers/formatters";
import { getTodayIsoDate } from "../helpers/dates";
import { api } from "../../convex/_generated/api";
import type { MenuItemKey } from "../types/ui";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";
import type { SyntheticEvent } from "react";
import { useMutation } from "convex/react";

export function AddEntryPanel({ activeItem, formType, setFormType, onAddExpense, onAddIncoming, onAddRecurring, bulkCreateExpenses, bulkCreateIncomings, saving, userOptions }: {
  activeItem: MenuItemKey;
  formType: FormType;
  setFormType: (value: FormType) => void;
  onAddExpense: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddIncoming: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddRecurring: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  bulkCreateExpenses: (args: {
    rows: Array<{
      expense: string;
      type: string;
      account: string;
      category: string;
      amount: number;
      date: string;
      paidTo: string;
      notes?: string;
      comments?: string;
      expenseId: string;
      baseExpenseId?: string;
      baseExpenseLabel?: string;
      subExpenseId?: string;
    }>;
  }) => Promise<unknown>;
  bulkCreateIncomings: (args: {
    rows: Array<{
      incoming: string;
      paidBy: string;
      incomeType: string;
      account: string;
      amount: number;
      date: string;
      monthYear: string;
      notes?: string;
      comments?: string;
      incomingId: string;
      baseIncomingId?: string;
      subIncomingId?: string;
    }>;
  }) => Promise<unknown>;
  saving: boolean;
  userOptions: UserOptions | undefined;
}) {
  const addUserOption = useMutation(api.userOptions.add);
  const todayIsoDate = getTodayIsoDate();
  const defaults = useMemo(
    () => ({
      expenseType: getDefaultOptionValue(userOptions, "expenseType"),
      incomeType: getDefaultOptionValue(userOptions, "incomeType"),
      account: getDefaultOptionValue(userOptions, "account"),
      category: getDefaultOptionValue(userOptions, "category"),
    }),
    [userOptions],
  );

  const [expenseType, setExpenseType] = useState("");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [incomingType, setIncomingType] = useState("");
  const [incomingAccount, setIncomingAccount] = useState("");
  const [recurringCategory, setRecurringCategory] = useState("");
  const [recurringKind, setRecurringKind] = useState<"expense" | "incoming">(
    "expense",
  );
  const [recurringStatus, setRecurringStatus] = useState<"active" | "inactive">(
    "active",
  );

  const [splitExpenseDrafts, setSplitExpenseDrafts] = useState<
    SplitExpenseDraft[]
  >([]);
  const [splitIncomingDrafts, setSplitIncomingDrafts] = useState<
    SplitIncomingDraft[]
  >([]);
  const [submittingSplit, setSubmittingSplit] = useState(false);

  const resetOptionState = useCallback(() => {
    setExpenseType(defaults.expenseType);
    setExpenseAccount(defaults.account);
    setExpenseCategory(defaults.category);
    setIncomingType(defaults.incomeType);
    setIncomingAccount(defaults.account);
    setRecurringCategory(defaults.category);
    setRecurringKind("expense");
    setRecurringStatus("active");
  }, [defaults]);

  const openForm = (nextFormType: FormType) => {
    resetOptionState();
    setFormType(nextFormType);
  };

  const openSplitExpenseForm = () => {
    resetOptionState();
    setSplitExpenseDrafts([buildEmptySplitExpenseDraft(todayIsoDate)]);
    setSplitIncomingDrafts([]);
    setFormType("expense");
  };

  const openSplitIncomingForm = () => {
    resetOptionState();
    setSplitIncomingDrafts([buildEmptySplitIncomingDraft(todayIsoDate)]);
    setSplitExpenseDrafts([]);
    setFormType("incoming");
  };

  const closeForm = () => {
    resetOptionState();
    setSplitExpenseDrafts([]);
    setSplitIncomingDrafts([]);
    setSubmittingSplit(false);
    setFormType(null);
  };

  const isSplitExpenseMode =
    formType === "expense" && splitExpenseDrafts.length > 0;
  const isSplitIncomingMode =
    formType === "incoming" && splitIncomingDrafts.length > 0;

  const updateSplitExpenseDraft = (
    index: number,
    key: keyof SplitExpenseDraft,
    value: string,
  ) => {
    setSplitExpenseDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row));
  };

  const addSplitExpenseDraft = () => {
    setSplitExpenseDrafts((current) => {
      const previous = current[current.length - 1];
      return [
        ...current,
        {
          ...buildEmptySplitExpenseDraft(todayIsoDate),
          date: previous?.date ?? todayIsoDate,
          account: previous?.account ?? "",
          paidTo: previous?.paidTo ?? "",
        },
      ];
    });
  };

  const updateSplitIncomingDraft = (
    index: number,
    key: keyof SplitIncomingDraft,
    value: string,
  ) => {
    setSplitIncomingDrafts((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row));
  };

  const addSplitIncomingDraft = () => {
    setSplitIncomingDrafts((current) => {
      const previous = current[current.length - 1];
      return [
        ...current,
        {
          ...buildEmptySplitIncomingDraft(todayIsoDate),
          date: previous?.date ?? todayIsoDate,
          account: previous?.account ?? "",
          monthYear: previous?.monthYear ?? "",
        },
      ];
    });
  };

  const createSplitExpenses = async () => {
    const cleaned = splitExpenseDrafts.map((row) => ({
      ...row,
      expense: row.expense.trim(),
      type: row.type.trim(),
      account: row.account.trim(),
      category: row.category.trim(),
      paidTo: row.paidTo.trim(),
      date: row.date.trim(),
      notes: row.notes.trim(),
      comments: row.comments.trim(),
    }));

    const invalid = cleaned.find(
      (row) =>
        !row.expense ||
        !row.type ||
        !row.account ||
        !row.category ||
        !row.paidTo ||
        !row.date ||
        !row.amount.trim(),
    );
    if (invalid) {
      window.alert("Fill all required fields on every split expense.");
      return;
    }

    setSubmittingSplit(true);
    try {
      const baseExpenseId = randomId16();
      const baseExpenseLabel = cleaned[0]?.expense || "Split Expense";
      await bulkCreateExpenses({
        rows: cleaned.map((row, index) => ({
          expense: row.expense,
          type: row.type,
          account: row.account,
          category: row.category,
          amount: toAmount(row.amount),
          date: row.date,
          paidTo: row.paidTo,
          notes: row.notes || undefined,
          comments: row.comments || undefined,
          expenseId: randomId16(),
          baseExpenseId,
          baseExpenseLabel,
          subExpenseId: String(index + 1).padStart(3, "0"),
        })),
      });

      await Promise.all([
        ...[...new Set(cleaned.map((row) => row.type))].map((value) =>
          saveOption(addUserOption, "expenseType", value)),
        ...[...new Set(cleaned.map((row) => row.account))].map((value) =>
          saveOption(addUserOption, "account", value)),
        ...[...new Set(cleaned.map((row) => row.category))].map((value) =>
          saveOption(addUserOption, "category", value)),
      ]);

      closeForm();
    } finally {
      setSubmittingSplit(false);
    }
  };

  const createSplitIncomings = async () => {
    const cleaned = splitIncomingDrafts.map((row) => ({
      ...row,
      incoming: row.incoming.trim(),
      paidBy: row.paidBy.trim(),
      incomeType: row.incomeType.trim(),
      account: row.account.trim(),
      date: row.date.trim(),
      monthYear: row.monthYear.trim(),
      notes: row.notes.trim(),
      comments: row.comments.trim(),
    }));

    const invalid = cleaned.find(
      (row) =>
        !row.incoming ||
        !row.paidBy ||
        !row.incomeType ||
        !row.account ||
        !row.date ||
        !row.monthYear ||
        !row.amount.trim(),
    );
    if (invalid) {
      window.alert("Fill all required fields on every split incoming.");
      return;
    }

    setSubmittingSplit(true);
    try {
      const baseIncomingId = randomId16();
      await bulkCreateIncomings({
        rows: cleaned.map((row, index) => ({
          incoming: row.incoming,
          paidBy: row.paidBy,
          incomeType: row.incomeType,
          account: row.account,
          amount: toAmount(row.amount),
          date: row.date,
          monthYear: row.monthYear,
          notes: row.notes || undefined,
          comments: row.comments || undefined,
          incomingId: randomId16(),
          baseIncomingId,
          subIncomingId: String(index + 1).padStart(3, "0"),
        })),
      });

      await Promise.all([
        ...[...new Set(cleaned.map((row) => row.incomeType))].map((value) =>
          saveOption(addUserOption, "incomeType", value)),
        ...[...new Set(cleaned.map((row) => row.account))].map((value) =>
          saveOption(addUserOption, "account", value)),
      ]);

      closeForm();
    } finally {
      setSubmittingSplit(false);
    }
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: "expense" | "incoming" }>)
        .detail;
      const kind = detail?.kind === "incoming" ? "incoming" : "expense";
      resetOptionState();
      setRecurringKind(kind);
      setFormType("recurring");
    };
    window.addEventListener("pensive:open-recurring-modal", listener);
    return () =>
      window.removeEventListener("pensive:open-recurring-modal", listener);
  }, [resetOptionState, setFormType]);

  const openModalFromActiveTab = () => {
    if (activeItem === "expenses") {
      openForm("expense");
      return;
    }
    if (activeItem === "incomings") {
      openForm("incoming");
      return;
    }
    if (activeItem === "recurrings") {
      openForm("recurring");
    }
  };

  return (
    <>
      {activeItem !== "options" && activeItem !== "recurrings" && (
        <div className="add-entry-launcher-row">
          <button
            type="button"
            className="add-entry-launcher"
            aria-label={`Add ${activeItem.slice(0, -1)}`}
            onClick={openModalFromActiveTab}
          >
            +
          </button>
          {activeItem === "expenses" ? (
            <button
              type="button"
              className="split-entry-launcher"
              onClick={openSplitExpenseForm}
            >
              + Split
            </button>
          ) : null}
          {activeItem === "incomings" ? (
            <button
              type="button"
              className="split-entry-launcher"
              onClick={openSplitIncomingForm}
            >
              + Split
            </button>
          ) : null}
        </div>
      )}

      {formType === "expense" && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className={isSplitExpenseMode ? "split-modal-shell" : ""}
            onClick={(e) => e.stopPropagation()}
          >
            {!isSplitExpenseMode ? (
              <div className="modal-card">
                <div className="modal-header">
                  <h3>Add Expense</h3>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={closeForm}
                  >
                    ✕
                  </button>
                </div>
                <form
                  className="entry-form modal-form"
                  onSubmit={(e) => void onAddExpense(e)}
                >
                  <input name="expense" placeholder="Expense" required />
                  <OptionPicker
                    kind="expenseType"
                    label="Expense Type"
                    name="type"
                    value={expenseType}
                    options={toOptionValues(userOptions?.expenseType)}
                    placeholder="Type"
                    required
                    onChange={setExpenseType}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="account"
                    label="Account"
                    name="account"
                    value={expenseAccount}
                    options={toOptionValues(userOptions?.account)}
                    placeholder="Account"
                    required
                    onChange={setExpenseAccount}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="category"
                    label="Category"
                    name="category"
                    value={expenseCategory}
                    options={toOptionValues(userOptions?.category)}
                    placeholder="Category"
                    required
                    onChange={setExpenseCategory}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <input name="amount" placeholder="Amount" required />
                  <input
                    name="date"
                    type="date"
                    defaultValue={todayIsoDate}
                    required
                  />
                  <input name="paidTo" placeholder="PaidTo" required />
                  <input name="notes" placeholder="Notes" />
                  <input name="comments" placeholder="Comments" />
                  <button
                    type="submit"
                    className="save-plus-btn"
                    aria-label="Save expense"
                    disabled={saving}
                  >
                    +
                  </button>
                </form>
              </div>
            ) : (
              <div className="split-modal-layout">
                <div className="split-modal-toolbar">
                  <h3>Add Split Expenses</h3>
                  <div className="split-modal-toolbar-actions">
                    <button
                      type="button"
                      className="split-entry-launcher"
                      onClick={addSplitExpenseDraft}
                      disabled={submittingSplit}
                    >
                      + Split
                    </button>
                    <button
                      type="button"
                      className="save-plus-btn split-create-btn"
                      onClick={() => void createSplitExpenses()}
                      disabled={submittingSplit || saving}
                    >
                      Create All
                    </button>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                      disabled={submittingSplit}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="split-modal-cards">
                  {splitExpenseDrafts.map((draft, index) => (
                    <div
                      key={`split-expense-${index}`}
                      className="modal-card split-modal-card"
                    >
                      <div className="modal-header">
                        <h3>Split #{index + 1}</h3>
                      </div>
                      <div className="entry-form modal-form">
                        <input
                          placeholder="Expense"
                          value={draft.expense}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "expense",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <OptionPicker
                          kind="expenseType"
                          label="Expense Type"
                          value={draft.type}
                          options={toOptionValues(userOptions?.expenseType)}
                          placeholder="Type"
                          required
                          onChange={(value) =>
                            updateSplitExpenseDraft(index, "type", value)
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <OptionPicker
                          kind="account"
                          label="Account"
                          value={draft.account}
                          options={toOptionValues(userOptions?.account)}
                          placeholder="Account"
                          required
                          onChange={(value) =>
                            updateSplitExpenseDraft(index, "account", value)
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <OptionPicker
                          kind="category"
                          label="Category"
                          value={draft.category}
                          options={toOptionValues(userOptions?.category)}
                          placeholder="Category"
                          required
                          onChange={(value) =>
                            updateSplitExpenseDraft(index, "category", value)
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <input
                          placeholder="Amount"
                          value={draft.amount}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "amount",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "date",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          placeholder="PaidTo"
                          value={draft.paidTo}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "paidTo",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          placeholder="Notes"
                          value={draft.notes}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "notes",
                              e.target.value,
                            )
                          }
                        />
                        <input
                          placeholder="Comments"
                          value={draft.comments}
                          onChange={(e) =>
                            updateSplitExpenseDraft(
                              index,
                              "comments",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {formType === "incoming" && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className={isSplitIncomingMode ? "split-modal-shell" : ""}
            onClick={(e) => e.stopPropagation()}
          >
            {!isSplitIncomingMode ? (
              <div className="modal-card">
                <div className="modal-header">
                  <h3>Add Incoming</h3>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={closeForm}
                  >
                    ✕
                  </button>
                </div>
                <form
                  className="entry-form modal-form"
                  onSubmit={(e) => void onAddIncoming(e)}
                >
                  <input name="incoming" placeholder="Incoming" required />
                  <input name="paidBy" placeholder="PaidBy" required />
                  <OptionPicker
                    kind="incomeType"
                    label="Income Type"
                    name="incomeType"
                    value={incomingType}
                    options={toOptionValues(userOptions?.incomeType)}
                    placeholder="IncomeType"
                    required
                    onChange={setIncomingType}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="account"
                    label="Account"
                    name="account"
                    value={incomingAccount}
                    options={toOptionValues(userOptions?.account)}
                    placeholder="Account"
                    required
                    onChange={setIncomingAccount}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <input name="amount" placeholder="Amount" required />
                  <input
                    name="date"
                    type="date"
                    defaultValue={todayIsoDate}
                    required
                  />
                  <input name="monthYear" placeholder="MonthYear" required />
                  <input name="notes" placeholder="Notes" />
                  <input name="comments" placeholder="Comments" />
                  <button
                    type="submit"
                    className="save-plus-btn"
                    aria-label="Save incoming"
                    disabled={saving}
                  >
                    +
                  </button>
                </form>
              </div>
            ) : (
              <div className="split-modal-layout">
                <div className="split-modal-toolbar">
                  <h3>Add Split Incomings</h3>
                  <div className="split-modal-toolbar-actions">
                    <button
                      type="button"
                      className="split-entry-launcher"
                      onClick={addSplitIncomingDraft}
                      disabled={submittingSplit}
                    >
                      + Split
                    </button>
                    <button
                      type="button"
                      className="save-plus-btn split-create-btn"
                      onClick={() => void createSplitIncomings()}
                      disabled={submittingSplit || saving}
                    >
                      Create All
                    </button>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={closeForm}
                      disabled={submittingSplit}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="split-modal-cards">
                  {splitIncomingDrafts.map((draft, index) => (
                    <div
                      key={`split-incoming-${index}`}
                      className="modal-card split-modal-card"
                    >
                      <div className="modal-header">
                        <h3>Split #{index + 1}</h3>
                      </div>
                      <div className="entry-form modal-form">
                        <input
                          placeholder="Incoming"
                          value={draft.incoming}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "incoming",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          placeholder="PaidBy"
                          value={draft.paidBy}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "paidBy",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <OptionPicker
                          kind="incomeType"
                          label="Income Type"
                          value={draft.incomeType}
                          options={toOptionValues(userOptions?.incomeType)}
                          placeholder="IncomeType"
                          required
                          onChange={(value) =>
                            updateSplitIncomingDraft(index, "incomeType", value)
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <OptionPicker
                          kind="account"
                          label="Account"
                          value={draft.account}
                          options={toOptionValues(userOptions?.account)}
                          placeholder="Account"
                          required
                          onChange={(value) =>
                            updateSplitIncomingDraft(index, "account", value)
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <input
                          placeholder="Amount"
                          value={draft.amount}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "amount",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "date",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          placeholder="MonthYear"
                          value={draft.monthYear}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "monthYear",
                              e.target.value,
                            )
                          }
                          required
                        />
                        <input
                          placeholder="Notes"
                          value={draft.notes}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "notes",
                              e.target.value,
                            )
                          }
                        />
                        <input
                          placeholder="Comments"
                          value={draft.comments}
                          onChange={(e) =>
                            updateSplitIncomingDraft(
                              index,
                              "comments",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {formType === "recurring" && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Recurring</h3>
              <button type="button" className="modal-close" onClick={closeForm}>
                ✕
              </button>
            </div>
            <form
              className="entry-form modal-form"
              onSubmit={(e) => void onAddRecurring(e)}
            >
              <label>
                Kind
                <select
                  name="kind"
                  value={recurringKind}
                  onChange={(e) =>
                    setRecurringKind(
                      e.target.value === "incoming" ? "incoming" : "expense",
                    )
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="incoming">Incoming</option>
                </select>
              </label>
              <label>
                Status
                <select
                  name="status"
                  value={recurringStatus}
                  onChange={(e) =>
                    setRecurringStatus(
                      e.target.value === "inactive" ? "inactive" : "active",
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <input name="name" placeholder="Name" required />
              <input name="price" placeholder="Price" required />
              <input name="frequency" placeholder="Frequency" required />
              <input name="dayOfMonth" placeholder="Day of Month" required />
              {recurringKind === "expense" ? (
                <>
                  <OptionPicker
                    kind="expenseType"
                    label="Expense Type"
                    name="expenseType"
                    value={expenseType}
                    options={toOptionValues(userOptions?.expenseType)}
                    placeholder="Type"
                    required
                    onChange={setExpenseType}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="account"
                    label="Expense Account"
                    name="expenseAccount"
                    value={expenseAccount}
                    options={toOptionValues(userOptions?.account)}
                    placeholder="Account"
                    required
                    onChange={setExpenseAccount}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="category"
                    label="Expense Category"
                    name="expenseCategory"
                    value={recurringCategory}
                    options={toOptionValues(userOptions?.category)}
                    placeholder="Category"
                    required
                    onChange={setRecurringCategory}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <input name="expensePaidTo" placeholder="Paid To" required />
                </>
              ) : (
                <>
                  <input name="incomingPaidBy" placeholder="Paid By" required />
                  <OptionPicker
                    kind="incomeType"
                    label="Income Type"
                    name="incomingType"
                    value={incomingType}
                    options={toOptionValues(userOptions?.incomeType)}
                    placeholder="Income Type"
                    required
                    onChange={setIncomingType}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                  <OptionPicker
                    kind="account"
                    label="Incoming Account"
                    name="incomingAccount"
                    value={incomingAccount}
                    options={toOptionValues(userOptions?.account)}
                    placeholder="Account"
                    required
                    onChange={setIncomingAccount}
                    onCreateOption={saveOption.bind(null, addUserOption)}
                  />
                </>
              )}
              <input name="notes" placeholder="Notes" />
              <button
                type="submit"
                className="save-plus-btn"
                aria-label="Save recurring"
                disabled={saving}
              >
                +
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}