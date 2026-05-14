import { getDefaultOptionValue, toOptionValues } from "../helpers/options";
import type { FormType, UserOptions } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import type { MenuItemKey } from "../types/ui";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";
import type { SyntheticEvent } from "react";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddEntryPanel({
  activeItem,
  formType,
  setFormType,
  onAddExpense,
  onAddIncoming,
  onAddRecurring,
  saving,
  userOptions,
}: {
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

  const resetOptionState = () => {
    setExpenseType(defaults.expenseType);
    setExpenseAccount(defaults.account);
    setExpenseCategory(defaults.category);
    setIncomingType(defaults.incomeType);
    setIncomingAccount(defaults.account);
    setRecurringCategory(defaults.category);
  };

  const openForm = (nextFormType: FormType) => {
    resetOptionState();
    setFormType(nextFormType);
  };

  const closeForm = () => {
    resetOptionState();
    setFormType(null);
  };

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
      {activeItem !== "options" && (
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
              <input name="status" placeholder="Status" required />
              <input name="name" placeholder="Name" required />
              <input name="type" placeholder="Type" required />
              <input name="price" placeholder="Price" required />
              <input name="frequency" placeholder="Frequency" required />
              <input name="dayOfMonth" placeholder="Day of Month" required />
              <input name="paidBy" placeholder="Paid By" required />
              <OptionPicker
                kind="category"
                label="Category"
                name="category"
                value={recurringCategory}
                options={toOptionValues(userOptions?.category)}
                placeholder="Category"
                required
                onChange={setRecurringCategory}
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
              <input name="paidTo" placeholder="Paid To" required />
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