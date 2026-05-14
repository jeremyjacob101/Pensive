import { getDefaultOptionValue, toOptionValues } from "../helpers/options";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormType, UserOptions } from "../types/workspace";
import { getTodayIsoDate } from "../helpers/dates";
import { api } from "../../convex/_generated/api";
import type { MenuItemKey } from "../types/ui";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";
import type { SyntheticEvent } from "react";
import { useMutation } from "convex/react";

export function AddEntryPanel({ activeItem, formType, setFormType, onAddExpense, onAddIncoming, onAddRecurring, saving, userOptions }: {
  activeItem: MenuItemKey;
  formType: FormType;
  setFormType: (value: FormType) => void;
  onAddExpense: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddIncoming: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddRecurring: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
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

  const closeForm = () => {
    resetOptionState();
    setFormType(null);
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
        </div>
      )}

      {formType === "expense" && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense</h3>
              <button type="button" className="modal-close" onClick={closeForm}>
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
        </div>
      )}

      {formType === "incoming" && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Incoming</h3>
              <button type="button" className="modal-close" onClick={closeForm}>
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