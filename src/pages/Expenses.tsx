import { handleDeleteExpense, handleStartEditExpense, handleUpdateExpense } from "./actions";
import { formatMonthLabel, formatShortDisplayDate, formatYearLabel } from "../helpers/dates";
import { getOptionColor, getScopedOptionValues, toOptionValues } from "../helpers/options";
import { useScrollMonthIndicator } from "../hooks/useScrollMonthIndicator";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { EditableRowActions } from "../components/EditableRowActions";
import type { Id } from "../../convex/_generated/dataModel";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import type { EditValues } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { useMemo, useRef, useState } from "react";
import { parseSubId } from "../helpers/subId";
import { CreditCard } from "lucide-react";
import { saveOption } from "./actions";

export function Expenses() {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );
  const [partnerPickAnchorId, setPartnerPickAnchorId] =
    useState<Id<"expenses"> | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);

  const updateExpense = useMutation(api.expenses.update);
  const deleteExpense = useMutation(api.expenses.remove);
  const addPartnerExpense = useMutation(api.expenses.addPartnerExpense);
  const unlinkExpenseFromPartners = useMutation(
    api.expenses.unlinkExpenseFromPartners,
  );
  const renameBaseExpense = useMutation(api.expenses.renameBaseExpense);
  const removeBaseExpense = useMutation(api.expenses.removeBaseExpense);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: expenses,
    status: expensesStatus,
    loadMore: loadMoreExpenses,
  } = usePaginatedQuery(api.expenses.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(expensesStatus, () => loadMoreExpenses(50));

  const displayItems = useMemo(() => {
    const groupedMap = new Map<
      string,
      {
        id: string;
        baseExpenseId: string;
        latestDate: string;
        latestCreation: number;
        totalAmount: number;
        rows: typeof expenses;
      }
    >();

    const soloRows: typeof expenses = [];

    for (const row of expenses) {
      const sharedBaseId = (row.baseExpenseId ?? "").trim();
      if (!sharedBaseId) {
        soloRows.push(row);
        continue;
      }

      const existing = groupedMap.get(sharedBaseId);

      if (!existing) {
        groupedMap.set(sharedBaseId, {
          id: `group:${sharedBaseId}`,
          baseExpenseId: sharedBaseId,
          latestDate: row.date,
          latestCreation: row._creationTime,
          totalAmount: row.amount,
          rows: [row],
        });
        continue;
      }

      existing.rows.push(row);
      existing.totalAmount += row.amount;
      if (
        row.date > existing.latestDate ||
        (row.date === existing.latestDate &&
          row._creationTime > existing.latestCreation)
      ) {
        existing.latestDate = row.date;
        existing.latestCreation = row._creationTime;
      }
    }

    const groupedItems = [...groupedMap.values()].map((group) => ({
      kind: "group" as const,
      id: group.id,
      date: group.latestDate,
      creation: group.latestCreation,
      group: {
        ...group,
        rows: [...group.rows].sort((a, b) => {
          const subDiff =
            parseSubId(a.subExpenseId) - parseSubId(b.subExpenseId);
          if (subDiff !== 0) return subDiff;
          return a._creationTime - b._creationTime;
        }),
      },
    }));

    const soloItems = soloRows.map((row) => ({
      kind: "solo" as const,
      id: `solo:${row._id}`,
      date: row.date,
      creation: row._creationTime,
      row,
    }));

    return [...groupedItems, ...soloItems].sort((a, b) => {
      if (a.date === b.date) {
        return b.creation - a.creation;
      }
      return b.date.localeCompare(a.date);
    });
  }, [expenses]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const { activeDate } = useScrollMonthIndicator(
    listRef,
    displayItems[0]?.date ?? "",
  );
  const monthText = formatMonthLabel(activeDate);
  const yearText = formatYearLabel(activeDate);
  const labelKey = `${monthText}-${yearText}`;
  const handlePickPartner = async (partnerId: Id<"expenses">) => {
    if (!partnerPickAnchorId || partnerPickAnchorId === partnerId) return;
    setSaving(true);
    try {
      await addPartnerExpense({
        anchorExpenseId: partnerPickAnchorId,
        partnerExpenseId: partnerId,
      });
      setPartnerPickAnchorId(null);
    } finally {
      setSaving(false);
    }
  };

  const renderPartnerEditor = (row: (typeof expenses)[number]) => {
    const baseId = (row.baseExpenseId ?? "").trim();
    const partnerRows = baseId
      ? expenses.filter(
          (expense) =>
            expense.baseExpenseId === baseId && expense._id !== row._id,
        )
      : [];

    return (
      <div className="partner-editor">
        <div className="partner-editor-header">Partner Expenses</div>
        {partnerRows.length === 0 ? (
          <div className="partner-editor-empty">No partner expenses yet.</div>
        ) : (
          <div className="partner-editor-list">
            {partnerRows.map((partner) => (
              <div key={partner._id} className="partner-editor-row">
                <span>
                  {partner.expense} · ₪{partner.amount.toLocaleString("en-US")}
                </span>
                <button
                  type="button"
                  className="icon-action-btn danger"
                  disabled={saving}
                  onClick={() =>
                    void unlinkExpenseFromPartners({ expenseId: partner._id })
                  }
                >
                  Unpartner
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="partner-editor-actions">
          <button
            type="button"
            className="split-entry-launcher"
            disabled={saving}
            onClick={() => {
              setEditingExpenseId(null);
              setPartnerPickAnchorId(row._id);
            }}
          >
            Add Partner
          </button>
          {baseId ? (
            <button
              type="button"
              className="icon-action-btn danger"
              disabled={saving}
              onClick={() =>
                void unlinkExpenseFromPartners({ expenseId: row._id })
              }
            >
              Unlink This Expense
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      {displayItems.length === 0 ? (
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
            <div className="expense-link-toolbar">
              {partnerPickAnchorId ? (
                <>
                  <div className="partner-pick-banner">
                    Pick an expense row to add as partner
                  </div>
                  <button
                    type="button"
                    className="split-entry-launcher"
                    disabled={saving}
                    onClick={() => setPartnerPickAnchorId(null)}
                  >
                    Cancel Pick
                  </button>
                </>
              ) : null}
            </div>

            {displayItems.map((item) => {
              if (item.kind === "group") {
                const group = item.group;
                const firstRow = group.rows[0];
                const groupTitle =
                  firstRow?.baseExpenseLabel?.trim() ||
                  firstRow?.expense ||
                  "Shared Expense";
                const accountColor = getOptionColor(
                  userOptions,
                  "account",
                  firstRow.account,
                );
                const typeColor = getOptionColor(
                  userOptions,
                  "expenseType",
                  firstRow.type,
                );
                const amountTooltip = group.rows
                  .map(
                    (row) =>
                      `${row.expense}: ₪${row.amount.toLocaleString("en-US")}`,
                  )
                  .join("\n");

                return (
                  <div
                    key={item.id}
                    data-row-date={item.date}
                    className="entry-card grouped-expense-card"
                  >
                    <div className="entry-card-main grouped-expense-main">
                      <div className="entry-card-primary">
                        <div
                          className="entry-card-amount"
                          title={amountTooltip}
                        >
                          <CreditCard
                            className="entry-card-account-icon"
                            style={{ color: accountColor }}
                            aria-hidden="true"
                          />
                          <span>
                            ₪{group.totalAmount.toLocaleString("en-US")}
                          </span>
                        </div>
                        <span
                          className="entry-card-primary-divider"
                          aria-hidden="true"
                        />
                        <div className="entry-card-title-wrap">
                          <span className="entry-card-title">{groupTitle}</span>
                          <span
                            className="entry-card-color-dot"
                            style={{ backgroundColor: typeColor }}
                          />
                        </div>
                      </div>

                      <div className="entry-card-date">
                        {formatShortDisplayDate(group.latestDate)}
                      </div>

                      <div className="entry-row-controls">
                        <button
                          type="button"
                          className="icon-action-btn"
                          disabled={saving}
                          aria-label="Rename grouped expense"
                          onClick={() => {
                            const nextName = window
                              .prompt("Rename grouped expense", groupTitle)
                              ?.trim();
                            if (!nextName || nextName === groupTitle) {
                              return;
                            }
                            setSaving(true);
                            void renameBaseExpense({
                              baseExpenseId: group.baseExpenseId,
                              baseExpenseLabel: nextName,
                            }).finally(() => setSaving(false));
                          }}
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          className="icon-action-btn danger"
                          disabled={saving}
                          aria-label="Delete grouped expense"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete all ${group.rows.length} sub-expenses in this group?`,
                              )
                            ) {
                              return;
                            }
                            setSaving(true);
                            void removeBaseExpense({
                              baseExpenseId: group.baseExpenseId,
                            }).finally(() => setSaving(false));
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    <div className="entry-card-details grouped-expense-details">
                      {group.rows.map((row, index) => {
                        const isEditing = editingExpenseId === row._id;
                        const rowTypeColor = getOptionColor(
                          userOptions,
                          "expenseType",
                          row.type,
                        );

                        return (
                          <div
                            key={row._id}
                            className={`grouped-expense-row${index > 0 ? " has-divider" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}`}
                            onClick={() =>
                              partnerPickAnchorId
                                ? void handlePickPartner(row._id)
                                : undefined
                            }
                          >
                            <div className="grouped-expense-row-main">
                              <div className="grouped-expense-row-title-wrap">
                                <span className="grouped-expense-row-title">
                                  {row.expense}
                                </span>
                                <span
                                  className="entry-card-color-dot"
                                  style={{ backgroundColor: rowTypeColor }}
                                />
                              </div>
                              <div className="grouped-expense-row-meta">
                                {row.type} · {row.category}
                                {row.subcategory
                                  ? ` / ${row.subcategory}`
                                  : ""}{" "}
                                · {row.account} · {row.paidTo}
                              </div>
                            </div>

                            <div className="grouped-expense-row-amount-date">
                              <span className="grouped-expense-row-amount">
                                ₪{row.amount.toLocaleString("en-US")}
                              </span>
                              <span className="grouped-expense-row-date">
                                {formatShortDisplayDate(row.date)}
                              </span>
                            </div>

                            <div className="entry-row-controls grouped-expense-row-controls">
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
                                  handleDeleteExpense(
                                    row,
                                    deleteExpense,
                                    setSaving,
                                  )
                                }
                              />
                            </div>

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
                                      options={toOptionValues(
                                        userOptions?.expenseType,
                                      )}
                                      placeholder="Type"
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          type: value,
                                        }))
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
                                      options={toOptionValues(
                                        userOptions?.account,
                                      )}
                                      placeholder="Account"
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          account: value,
                                        }))
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
                                      options={toOptionValues(
                                        userOptions?.category,
                                      )}
                                      placeholder="Category"
                                      onChange={(value) =>
                                        setEditValues((v) => {
                                          const next: EditValues = {
                                            ...v,
                                            category: value,
                                          };
                                          const scoped = getScopedOptionValues(
                                            userOptions,
                                            "subcategory",
                                            value,
                                          );
                                          if (
                                            (next.subcategory ?? "") &&
                                            !scoped.includes(
                                              next.subcategory ?? "",
                                            )
                                          ) {
                                            next.subcategory = "";
                                          }
                                          return next;
                                        })
                                      }
                                      onCreateOption={saveOption.bind(
                                        null,
                                        addUserOption,
                                      )}
                                    />
                                    <OptionPicker
                                      kind="subcategory"
                                      label="Subcategory"
                                      value={editValues.subcategory ?? ""}
                                      options={getScopedOptionValues(
                                        userOptions,
                                        "subcategory",
                                        editValues.category ?? "",
                                      )}
                                      placeholder="Subcategory"
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          subcategory: value,
                                        }))
                                      }
                                      onCreateOption={saveOption.bind(
                                        null,
                                        addUserOption,
                                      )}
                                      parentValue={editValues.category ?? ""}
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
                                    {renderPartnerEditor(row)}
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
                );
              }

              const row = item.row;
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
                  key={item.id}
                  data-row-date={item.date}
                  className={`entry-card${isExpanded ? " is-expanded" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}`}
                  onClick={() =>
                    partnerPickAnchorId
                      ? void handlePickPartner(row._id)
                      : undefined
                  }
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
                          <strong>Subcategory:</strong> {row.subcategory || "-"}
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
                              setEditValues((v) => {
                                const next: EditValues = {
                                  ...v,
                                  category: value,
                                };
                                const scoped = getScopedOptionValues(
                                  userOptions,
                                  "subcategory",
                                  value,
                                );
                                if (
                                  (next.subcategory ?? "") &&
                                  !scoped.includes(next.subcategory ?? "")
                                ) {
                                  next.subcategory = "";
                                }
                                return next;
                              })
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="subcategory"
                            label="Subcategory"
                            value={editValues.subcategory ?? ""}
                            options={getScopedOptionValues(
                              userOptions,
                              "subcategory",
                              editValues.category ?? "",
                            )}
                            placeholder="Subcategory"
                            onChange={(value) =>
                              setEditValues((v) => ({
                                ...v,
                                subcategory: value,
                              }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={editValues.category ?? ""}
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
                          {renderPartnerEditor(row)}
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