import { handleDeleteExpense, handleStartEditExpense, handleUpdateExpense } from "./actions";
import { formatMonthLabel, formatShortDisplayDate, formatYearLabel } from "../helpers/dates";
import { useScrollMonthIndicator } from "../hooks/useScrollMonthIndicator";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { EditableRowActions } from "../components/EditableRowActions";
import { getOptionColor, toOptionValues } from "../helpers/options";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import type { EditValues } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { CreditCard } from "lucide-react";
import { useRef, useState } from "react";
import { saveOption } from "./actions";

export function Expenses() {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);

  const updateExpense = useMutation(api.expenses.update);
  const deleteExpense = useMutation(api.expenses.remove);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: expenses,
    status: expensesStatus,
    loadMore: loadMoreExpenses,
  } = usePaginatedQuery(api.expenses.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(expensesStatus, () => loadMoreExpenses(50));
  const listRef = useRef<HTMLDivElement | null>(null);
  const { activeDate } = useScrollMonthIndicator(
    listRef,
    expenses[0]?.date ?? "",
  );
  const monthText = formatMonthLabel(activeDate);
  const yearText = formatYearLabel(activeDate);
  const labelKey = `${monthText}-${yearText}`;

  return (
    <>
      {expenses.length === 0 ? (
        <p>No expenses yet.</p>
      ) : (
        <div className="entries-with-month">
          <aside className="month-indicator" aria-hidden="true">
            <span key={labelKey} className="month-indicator-value">
              <span className="month-indicator-month">{monthText}</span>
              <span className="month-indicator-year">{yearText}</span>
            </span>
          </aside>
          <div ref={listRef} className="entry-card-list">
            {expenses.map((row) => {
              const isExpanded = expandedExpenseId === row._id;
              const isEditing = editingExpenseId === row._id;
              const typeColor = getOptionColor(
                userOptions,
                "expenseType",
                row.type,
              );
              const accountColor = getOptionColor(
                userOptions,
                "account",
                row.account,
              );

              return (
                <div
                  key={row._id}
                  data-row-date={row.date}
                  className={`entry-card${isExpanded ? " is-expanded" : ""}`}
                >
                  <div className="entry-card-main">
                    <div className="entry-card-primary">
                      <div className="entry-card-amount">
                        <CreditCard
                          className="entry-card-account-icon"
                          style={{ color: accountColor }}
                          aria-hidden="true"
                        />
                        <span>₪{row.amount}</span>
                      </div>
                      <span
                        className="entry-card-primary-divider"
                        aria-hidden="true"
                      />
                      <div className="entry-card-title-wrap">
                        <span className="entry-card-title">{row.expense}</span>
                        <span
                          className="entry-card-color-dot"
                          style={{ backgroundColor: typeColor }}
                        />
                      </div>
                    </div>
                    <div className="entry-card-date">
                      {formatShortDisplayDate(row.date)}
                    </div>
                    <div className="entry-row-controls">
                      <EditableRowActions
                        isEditing={false}
                        saving={saving}
                        onSave={() => {}}
                        onCancel={() => {}}
                        onEdit={() =>
                          handleStartEditExpense(
                            row,
                            setEditingExpenseId,
                            setEditValues,
                          )
                        }
                        onDelete={() =>
                          handleDeleteExpense(row, deleteExpense, setSaving)
                        }
                      />
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() =>
                          setExpandedExpenseId((prev) =>
                            prev === row._id ? null : row._id)
                        }
                        aria-label={isExpanded ? "Collapse row" : "Expand row"}
                      >
                        {isExpanded ? "▴" : "▾"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="entry-card-details">
                      <div className="entry-detail-grid static">
                        <div>
                          <strong>Type:</strong> {row.type}
                        </div>
                        <div>
                          <strong>Account:</strong> {row.account}
                        </div>
                        <div>
                          <strong>Category:</strong> {row.category}
                        </div>
                        <div>
                          <strong>Paid To:</strong> {row.paidTo}
                        </div>
                        <div>
                          <strong>Notes:</strong> {row.notes ?? "-"}
                        </div>
                        <div>
                          <strong>Comments:</strong> {row.comments ?? "-"}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div
                      className="modal-overlay"
                      onClick={() => setEditingExpenseId(null)}
                    >
                      <div
                        className="modal-card"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-header">
                          <h3>Edit Expense</h3>
                          <button
                            type="button"
                            className="modal-close"
                            onClick={() => setEditingExpenseId(null)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="entry-form modal-form">
                          <input
                            value={editValues.expense ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                expense: e.target.value,
                              }))
                            }
                          />
                          <OptionPicker
                            kind="expenseType"
                            label="Expense Type"
                            value={editValues.type ?? ""}
                            options={toOptionValues(userOptions?.expenseType)}
                            placeholder="Type"
                            onChange={(value) =>
                              setEditValues((v) => ({ ...v, type: value }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="account"
                            label="Account"
                            value={editValues.account ?? ""}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Account"
                            onChange={(value) =>
                              setEditValues((v) => ({ ...v, account: value }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="category"
                            label="Category"
                            value={editValues.category ?? ""}
                            options={toOptionValues(userOptions?.category)}
                            placeholder="Category"
                            onChange={(value) =>
                              setEditValues((v) => ({ ...v, category: value }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <input
                            value={editValues.amount ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                amount: e.target.value,
                              }))
                            }
                          />
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
                          <input
                            value={editValues.paidTo ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                paidTo: e.target.value,
                              }))
                            }
                          />
                          <input
                            value={editValues.notes ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                notes: e.target.value,
                              }))
                            }
                          />
                          <input
                            value={editValues.comments ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                comments: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="save-plus-btn"
                            aria-label="Save expense changes"
                            disabled={saving}
                            onClick={() =>
                              handleUpdateExpense(row, {
                                updateExpense,
                                editValues,
                                setSaving,
                                setEditingExpenseId,
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}