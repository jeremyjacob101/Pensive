import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import type { Doc } from "../convex/_generated/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import type { FormEvent } from "react";
import { useState } from "react";

const headers = [
  "Expense",
  "Type",
  "Account",
  "Category",
  "Amount",
  "Date",
  "PaidTo",
  "Notes",
  "Comments",
  "ExpenseID",
] as const;

const incomingHeaders = [
  "Incoming",
  "PaidBy",
  "IncomeType",
  "Account",
  "Amount",
  "Date",
  "MonthYear",
  "Notes",
  "Comments",
  "IncomingID",
] as const;

const recurringHeaders = [
  "Status",
  "Name",
  "Type",
  "Price",
  "Frequency",
  "Day of Month",
  "Paid By",
  "Category",
  "Paid To",
  "Notes",
] as const;

function randomId16() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function toAmount(value: string) {
  const cleaned = value.trim().replace(/[^0-9.-]/g, "");
  const n = Number(cleaned || "0");
  return Number.isFinite(n) ? n : 0;
}

function SignInForm() {
  const { signIn } = useAuthActions();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn("password", {
        flow: mode,
        email: username.trim().toLowerCase(),
        password,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>Pensive</h1>
      <form className="entry-form" onSubmit={onSubmit}>
        <input
          name="username"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "signIn"
              ? "Sign In"
              : "Create Account"}
        </button>
        <button
          type="button"
          onClick={() =>
            setMode((prev) => (prev === "signIn" ? "signUp" : "signIn"))
          }
        >
          {mode === "signIn"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
        {error ? <p>{error}</p> : null}
      </form>
    </main>
  );
}

function DataApp() {
  const { signOut } = useAuthActions();
  const [activeTab, setActiveTab] = useState<
    "expenses" | "incomings" | "recurrings"
  >("expenses");
  const [formType, setFormType] = useState<
    "expense" | "incoming" | "recurring" | null
  >(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingIncomingId, setEditingIncomingId] = useState<string | null>(
    null,
  );
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(
    null,
  );
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const createExpense = useMutation(api.expenses.create);
  const createIncoming = useMutation(api.incomings.create);
  const createRecurring = useMutation(api.recurrings.create);
  const updateExpense = useMutation(api.expenses.update);
  const updateIncoming = useMutation(api.incomings.update);
  const updateRecurring = useMutation(api.recurrings.update);
  const deleteExpense = useMutation(api.expenses.remove);
  const deleteIncoming = useMutation(api.incomings.remove);
  const deleteRecurring = useMutation(api.recurrings.remove);
  const {
    results: expenses,
    status: expensesStatus,
    loadMore: loadMoreExpenses,
  } = usePaginatedQuery(api.expenses.list, {}, { initialNumItems: 25 });
  const {
    results: incomings,
    status: incomingsStatus,
    loadMore: loadMoreIncomings,
  } = usePaginatedQuery(api.incomings.list, {}, { initialNumItems: 25 });
  const {
    results: recurrings,
    status: recurringsStatus,
    loadMore: loadMoreRecurrings,
  } = usePaginatedQuery(api.recurrings.list, {}, { initialNumItems: 25 });

  async function onAddExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createExpense({
        expense: String(form.get("expense") ?? ""),
        type: String(form.get("type") ?? ""),
        account: String(form.get("account") ?? ""),
        category: String(form.get("category") ?? ""),
        amount: toAmount(String(form.get("amount") ?? "")),
        date: String(form.get("date") ?? ""),
        paidTo: String(form.get("paidTo") ?? ""),
        notes: String(form.get("notes") ?? "") || undefined,
        comments: String(form.get("comments") ?? "") || undefined,
        expenseId: randomId16(),
      });
      e.currentTarget.reset();
      setFormType(null);
      setActiveTab("expenses");
    } finally {
      setSaving(false);
    }
  }

  async function onAddIncoming(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createIncoming({
        incoming: String(form.get("incoming") ?? ""),
        paidBy: String(form.get("paidBy") ?? ""),
        incomeType: String(form.get("incomeType") ?? ""),
        account: String(form.get("account") ?? ""),
        amount: toAmount(String(form.get("amount") ?? "")),
        date: String(form.get("date") ?? ""),
        monthYear: String(form.get("monthYear") ?? ""),
        notes: String(form.get("notes") ?? "") || undefined,
        comments: String(form.get("comments") ?? "") || undefined,
        incomingId: randomId16(),
      });
      e.currentTarget.reset();
      setFormType(null);
      setActiveTab("incomings");
    } finally {
      setSaving(false);
    }
  }

  async function onAddRecurring(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await createRecurring({
        status: String(form.get("status") ?? ""),
        name: String(form.get("name") ?? ""),
        type: String(form.get("type") ?? ""),
        price: toAmount(String(form.get("price") ?? "")),
        frequency: String(form.get("frequency") ?? ""),
        dayOfMonth: Number(String(form.get("dayOfMonth") ?? "0")) || 0,
        paidBy: String(form.get("paidBy") ?? ""),
        category: String(form.get("category") ?? ""),
        paidTo: String(form.get("paidTo") ?? ""),
        notes: String(form.get("notes") ?? "") || undefined,
      });
      e.currentTarget.reset();
      setFormType(null);
      setActiveTab("recurrings");
    } finally {
      setSaving(false);
    }
  }

  function startEditExpense(row: Doc<"expenses">) {
    setEditingExpenseId(row._id);
    setEditValues({
      expense: row.expense,
      type: row.type,
      account: row.account,
      category: row.category,
      amount: String(row.amount),
      date: row.date,
      paidTo: row.paidTo,
      notes: row.notes ?? "",
      comments: row.comments ?? "",
      expenseId: row.expenseId,
    });
  }

  function startEditIncoming(row: Doc<"incomings">) {
    setEditingIncomingId(row._id);
    setEditValues({
      incoming: row.incoming,
      paidBy: row.paidBy,
      incomeType: row.incomeType,
      account: row.account,
      amount: String(row.amount),
      date: row.date,
      monthYear: row.monthYear,
      notes: row.notes ?? "",
      comments: row.comments ?? "",
      incomingId: row.incomingId,
    });
  }

  function startEditRecurring(row: Doc<"recurrings">) {
    setEditingRecurringId(row._id);
    setEditValues({
      status: row.status,
      name: row.name,
      type: row.type ?? "",
      price: String(row.price),
      frequency: row.frequency,
      dayOfMonth: String(row.dayOfMonth),
      paidBy: row.paidBy,
      category: row.category,
      paidTo: row.paidTo,
      notes: row.notes ?? "",
    });
  }

  return (
    <main className="page">
      <div className="tabs">
        <button type="button" className="tab" onClick={() => void signOut()}>
          Sign Out
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className="tab"
          onClick={() => setFormType("expense")}
        >
          Add Expense
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => setFormType("incoming")}
        >
          Add Incoming
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => setFormType("recurring")}
        >
          Add Recurring
        </button>
      </div>

      {formType === "expense" && (
        <form className="entry-form" onSubmit={onAddExpense}>
          <input name="expense" placeholder="Expense" required />
          <input name="type" placeholder="Type" required />
          <input name="account" placeholder="Account" required />
          <input name="category" placeholder="Category" required />
          <input name="amount" placeholder="Amount" required />
          <input name="date" type="date" required />
          <input name="paidTo" placeholder="PaidTo" required />
          <input name="notes" placeholder="Notes" />
          <input name="comments" placeholder="Comments" />
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Expense"}
          </button>
          <button type="button" onClick={() => setFormType(null)}>
            Cancel
          </button>
        </form>
      )}

      {formType === "incoming" && (
        <form className="entry-form" onSubmit={onAddIncoming}>
          <input name="incoming" placeholder="Incoming" required />
          <input name="paidBy" placeholder="PaidBy" required />
          <input name="incomeType" placeholder="IncomeType" required />
          <input name="account" placeholder="Account" required />
          <input name="amount" placeholder="Amount" required />
          <input name="date" type="date" required />
          <input name="monthYear" placeholder="MonthYear" required />
          <input name="notes" placeholder="Notes" />
          <input name="comments" placeholder="Comments" />
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Incoming"}
          </button>
          <button type="button" onClick={() => setFormType(null)}>
            Cancel
          </button>
        </form>
      )}

      {formType === "recurring" && (
        <form className="entry-form" onSubmit={onAddRecurring}>
          <input name="status" placeholder="Status" required />
          <input name="name" placeholder="Name" required />
          <input name="type" placeholder="Type" required />
          <input name="price" placeholder="Price" required />
          <input name="frequency" placeholder="Frequency" required />
          <input name="dayOfMonth" placeholder="Day of Month" required />
          <input name="paidBy" placeholder="Paid By" required />
          <input name="category" placeholder="Category" required />
          <input name="paidTo" placeholder="Paid To" required />
          <input name="notes" placeholder="Notes" />
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Recurring"}
          </button>
          <button type="button" onClick={() => setFormType(null)}>
            Cancel
          </button>
        </form>
      )}

      <div className="tabs">
        <button
          type="button"
          className={activeTab === "expenses" ? "tab active" : "tab"}
          onClick={() => setActiveTab("expenses")}
        >
          Expenses
        </button>
        <button
          type="button"
          className={activeTab === "incomings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("incomings")}
        >
          Incomings
        </button>
        <button
          type="button"
          className={activeTab === "recurrings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("recurrings")}
        >
          Recurrings
        </button>
      </div>

      {activeTab === "expenses" ? (
        <>
          <table>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={headers.length}>No expenses yet.</td>
                </tr>
              ) : (
                expenses.map((row) => {
                  const isEditing = editingExpenseId === row._id;
                  return (
                    <tr key={row._id}>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.expense ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                expense: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.expense
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.type ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                type: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.type
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.account ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                account: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.account
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.category ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                category: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.category
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.amount ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                amount: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.amount
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.date ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.date
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.paidTo ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                paidTo: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.paidTo
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.notes ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                notes: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (row.notes ?? "")
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.comments ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                comments: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (row.comments ?? "")
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.expenseId ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                expenseId: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.expenseId
                        )}
                      </td>
                      <td className="actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await updateExpense({
                                    id: row._id,
                                    expense: editValues.expense ?? "",
                                    type: editValues.type ?? "",
                                    account: editValues.account ?? "",
                                    category: editValues.category ?? "",
                                    amount: toAmount(editValues.amount ?? ""),
                                    date: editValues.date ?? "",
                                    paidTo: editValues.paidTo ?? "",
                                    notes: editValues.notes || undefined,
                                    comments: editValues.comments || undefined,
                                    expenseId: editValues.expenseId ?? "",
                                  });
                                  setEditingExpenseId(null);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingExpenseId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditExpense(row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await deleteExpense({ id: row._id });
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {expensesStatus === "CanLoadMore" ? (
            <button type="button" onClick={() => loadMoreExpenses(25)}>
              Load More Expenses
            </button>
          ) : null}
        </>
      ) : activeTab === "incomings" ? (
        <>
          <table>
            <thead>
              <tr>
                {incomingHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incomings.length === 0 ? (
                <tr>
                  <td colSpan={incomingHeaders.length}>No incomings yet.</td>
                </tr>
              ) : (
                incomings.map((row) => {
                  const isEditing = editingIncomingId === row._id;
                  return (
                    <tr key={row._id}>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.incoming ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                incoming: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.incoming
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.paidBy ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                paidBy: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.paidBy
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.incomeType ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                incomeType: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.incomeType
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.account ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                account: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.account
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.amount ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                amount: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.amount
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.date ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                date: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.date
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.monthYear ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                monthYear: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.monthYear
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.notes ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                notes: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (row.notes ?? "")
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.comments ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                comments: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (row.comments ?? "")
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.incomingId ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                incomingId: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.incomingId
                        )}
                      </td>
                      <td className="actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await updateIncoming({
                                    id: row._id,
                                    incoming: editValues.incoming ?? "",
                                    paidBy: editValues.paidBy ?? "",
                                    incomeType: editValues.incomeType ?? "",
                                    account: editValues.account ?? "",
                                    amount: toAmount(editValues.amount ?? ""),
                                    date: editValues.date ?? "",
                                    monthYear: editValues.monthYear ?? "",
                                    notes: editValues.notes || undefined,
                                    comments: editValues.comments || undefined,
                                    incomingId: editValues.incomingId ?? "",
                                  });
                                  setEditingIncomingId(null);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingIncomingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditIncoming(row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await deleteIncoming({ id: row._id });
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {incomingsStatus === "CanLoadMore" ? (
            <button type="button" onClick={() => loadMoreIncomings(25)}>
              Load More Incomings
            </button>
          ) : null}
        </>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                {recurringHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurrings.length === 0 ? (
                <tr>
                  <td colSpan={recurringHeaders.length}>No recurrings yet.</td>
                </tr>
              ) : (
                recurrings.map((row) => {
                  const isEditing = editingRecurringId === row._id;
                  return (
                    <tr key={row._id}>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.status ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                status: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.status
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.name ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                name: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.type ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                type: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.type
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.price ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                price: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.price
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.frequency ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                frequency: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.frequency
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.dayOfMonth ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                dayOfMonth: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.dayOfMonth
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.paidBy ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                paidBy: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.paidBy
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.category ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                category: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.category
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.paidTo ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                paidTo: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          row.paidTo
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editValues.notes ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                notes: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          (row.notes ?? "")
                        )}
                      </td>
                      <td className="actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await updateRecurring({
                                    id: row._id,
                                    status: editValues.status ?? "",
                                    name: editValues.name ?? "",
                                    type: editValues.type ?? "",
                                    price: toAmount(editValues.price ?? ""),
                                    frequency: editValues.frequency ?? "",
                                    dayOfMonth:
                                      Number(editValues.dayOfMonth ?? "0") || 0,
                                    paidBy: editValues.paidBy ?? "",
                                    category: editValues.category ?? "",
                                    paidTo: editValues.paidTo ?? "",
                                    notes: editValues.notes || undefined,
                                  });
                                  setEditingRecurringId(null);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRecurringId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditRecurring(row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await deleteRecurring({ id: row._id });
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {recurringsStatus === "CanLoadMore" ? (
            <button type="button" onClick={() => loadMoreRecurrings(25)}>
              Load More Recurrings
            </button>
          ) : null}
        </>
      )}
    </main>
  );
}

function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <main className="page">Loading...</main>;
  }

  if (!isAuthenticated) {
    return <SignInForm />;
  }

  return <DataApp />;
}

export default App;
